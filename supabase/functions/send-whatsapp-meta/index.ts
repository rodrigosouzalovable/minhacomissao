import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClienteData {
  cpf?: string;
  nome?: string;
  telefone: string;
  atraso?: string | number;
  saldo?: number;
}

const formatPrimeiroNome = (nome: string): string => {
  if (!nome) return '';
  const p = nome.trim().split(/\s+/)[0].toLowerCase();
  return p.charAt(0).toUpperCase() + p.slice(1);
};
const fmtBRL = (v: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

function resolveVar(field: string, c: ClienteData): string {
  switch (field) {
    case '{nome}': return c.nome || '';
    case '{primeiro_nome}': return formatPrimeiroNome(c.nome || '');
    case '{cpf}': return c.cpf || '';
    case '{atraso}': return String(c.atraso ?? '');
    case '{saldo}': return fmtBRL(Number(c.saldo || 0));
    case '{avista}': return fmtBRL(Number(c.saldo || 0) * 0.5);
    case '{parcelado}': {
      const v = Number(c.saldo || 0) * 0.7;
      for (let i = 2; i <= 24; i++) {
        const p = v / i;
        if (p >= 100) return `${i}x de ${fmtBRL(p)}`;
      }
      return fmtBRL(v);
    }
    default: return field;
  }
}

function formatTelefone(tel: string): string {
  const d = tel.replace(/\D/g, '');
  return d.startsWith('55') ? d : `55${d}`;
}

function resolveNamedVar(name: string, c: ClienteData): string {
  const n = name.toLowerCase();
  if (n === 'name' || n === 'nome' || n === 'primeiro_nome') return formatPrimeiroNome(c.nome || '') || 'cliente';
  if (n === 'nome_completo' || n === 'full_name') return c.nome || 'cliente';
  if (n === 'cpf') return c.cpf || '';
  if (n === 'atraso' || n === 'delay') return String(c.atraso ?? '');
  if (n === 'saldo' || n === 'valor' || n === 'value') return fmtBRL(Number(c.saldo || 0));
  if (n === 'avista') return fmtBRL(Number(c.saldo || 0) * 0.5);
  return resolveVar(`{${n}}`, c) || ' ';
}

async function sendOne(inst: any, template: any, cliente: ClienteData) {
  const variaveis = (template.variaveis || {}) as Record<string, string>;
  const bodyText: string = template.body_text || '';
  const sortedKeys = Object.keys(variaveis).sort((a, b) => Number(a) - Number(b));

  let parameters: any[] = [];

  if (sortedKeys.length > 0) {
    parameters = sortedKeys.map(k => ({
      type: 'text',
      text: resolveVar(variaveis[k] || '', cliente) || ' ',
    }));
  } else {
    // Auto-detect placeholders from body_text
    const namedMatches = [...bodyText.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g)];
    const positionalMatches = [...bodyText.matchAll(/\{\{\s*(\d+)\s*\}\}/g)];

    if (namedMatches.length > 0) {
      const seen = new Set<string>();
      for (const m of namedMatches) {
        const name = m[1];
        if (seen.has(name)) continue;
        seen.add(name);
        parameters.push({
          type: 'text',
          parameter_name: name,
          text: resolveNamedVar(name, cliente),
        });
      }
    } else if (positionalMatches.length > 0) {
      const seen = new Set<string>();
      for (const m of positionalMatches) {
        if (seen.has(m[1])) continue;
        seen.add(m[1]);
        parameters.push({
          type: 'text',
          text: formatPrimeiroNome(cliente.nome || '') || 'cliente',
        });
      }
    }
  }

  const body: any = {
    messaging_product: 'whatsapp',
    to: formatTelefone(cliente.telefone),
    type: 'template',
    template: {
      name: template.nome_template,
      language: { code: template.idioma || 'pt_BR' },
      components: parameters.length ? [{ type: 'body', parameters }] : [],
    },
  };

  const res = await fetch(`https://graph.facebook.com/v21.0/${inst.phone_number_id}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${inst.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Falha Meta API');
  return data?.messages?.[0]?.id || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { template_id, instancia_ids, clientes, min_sec = 30, max_sec = 90, user_id } = await req.json();
    if (!template_id || !Array.isArray(clientes) || clientes.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Parâmetros obrigatórios: template_id, clientes[]' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: template } = await supabase
      .from('meta_whatsapp_templates').select('*').eq('id', template_id).maybeSingle();
    if (!template) throw new Error('Template não encontrado');
    if (template.status !== 'approved') throw new Error('Template não está aprovado pela Meta');

    let q = supabase.from('meta_whatsapp_instances').select('*').eq('ativo', true);
    if (instancia_ids?.length) q = q.in('id', instancia_ids);
    if (user_id) q = q.eq('user_id', user_id);
    const { data: instances } = await q;
    if (!instances || instances.length === 0) throw new Error('Sem instâncias Meta ativas');

    // Reset daily counters
    const today = new Date().toISOString().slice(0, 10);
    for (const inst of instances) {
      if (inst.ultimo_reset !== today) {
        await supabase.from('meta_whatsapp_instances').update({
          enviados_hoje: 0, ultimo_reset: today,
        }).eq('id', inst.id);
        inst.enviados_hoje = 0; inst.ultimo_reset = today;
      }
    }

    // Dedup phones
    const seen = new Set<string>();
    const unique = clientes.filter((c: ClienteData) => {
      const p = (c.telefone || '').replace(/\D/g, '');
      if (!p || seen.has(p)) return false;
      seen.add(p); return true;
    });

    let enviados = 0, erros = 0;
    let rr = 0;
    for (let i = 0; i < unique.length; i++) {
      const cliente = unique[i];
      const avail = instances.filter(it => (it.enviados_hoje || 0) < (it.tier_diario || 250));
      if (!avail.length) { console.error('[Meta] Todas instâncias atingiram tier_diario'); break; }
      const inst = avail[rr % avail.length]; rr++;

      try {
        const waId = await sendOne(inst, template, cliente);
        enviados++;
        inst.enviados_hoje = (inst.enviados_hoje || 0) + 1;
        await supabase.from('meta_whatsapp_instances')
          .update({ enviados_hoje: inst.enviados_hoje }).eq('id', inst.id);
        await supabase.from('meta_whatsapp_envios_log').insert({
          instancia_id: inst.id,
          user_id: user_id || inst.user_id,
          telefone: formatTelefone(cliente.telefone),
          template_nome: template.nome_template,
          status: 'sent',
          wa_message_id: waId,
        });
      } catch (e) {
        erros++;
        await supabase.from('meta_whatsapp_envios_log').insert({
          instancia_id: inst.id,
          user_id: user_id || inst.user_id,
          telefone: formatTelefone(cliente.telefone),
          template_nome: template.nome_template,
          status: 'failed',
          erro: e instanceof Error ? e.message : 'erro',
        });
      }

      if (i < unique.length - 1) {
        const lo = Math.max(1, Number(min_sec) || 1);
        const hi = Math.max(lo, Number(max_sec) || lo);
        const delay = Math.floor(Math.random() * (hi - lo + 1)) + lo;
        await new Promise(r => setTimeout(r, delay * 1000));
      }
    }

    return new Response(JSON.stringify({ success: true, enviados, erros, total: unique.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
