// Using built-in Deno.serve (no import needed)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_HEADER_IMAGE_URL =
  Deno.env.get('META_DEFAULT_HEADER_IMAGE_URL') ||
  'https://minhacomissao.lovable.app/perfil-souza-ribeiro.png';

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

function buildParameters(template: any, cliente: ClienteData, forceFormat?: 'named' | 'positional'): { parameters: any[]; format: 'named' | 'positional' | 'none' } {
  const variaveis = (template.variaveis || {}) as Record<string, string>;
  const bodyText: string = template.body_text || '';

  const sortedKeys = Object.keys(variaveis).filter(k => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
  const namedMatches = [...bodyText.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g)];
  const positionalMatches = [...bodyText.matchAll(/\{\{\s*(\d+)\s*\}\}/g)];

  const useNamed = forceFormat
    ? forceFormat === 'named'
    : (namedMatches.length > 0 && positionalMatches.length === 0);

  if (useNamed) {
    const seen = new Set<string>();
    const parameters: any[] = [];
    for (const m of namedMatches) {
      const key = m[1];
      if (seen.has(key)) continue;
      seen.add(key);
      const value = resolveNamedVar(key, cliente) || 'cliente';
      parameters.push({ type: 'text', parameter_name: key, text: value });
    }
    // Se o template só tem {{1}} mas usuário forçou named, mapeia posicionais para parameter_name
    if (parameters.length === 0 && positionalMatches.length > 0) {
      const seen2 = new Set<string>();
      for (const m of positionalMatches) {
        const k = m[1];
        if (seen2.has(k)) continue;
        seen2.add(k);
        const field = variaveis[k] || 'name';
        const value = resolveNamedVar(field.replace(/[{}]/g, ''), cliente) || 'cliente';
        parameters.push({ type: 'text', parameter_name: field.replace(/[{}]/g, '') || 'name', text: value });
      }
    }
    return { parameters, format: 'named' };
  }

  // POSICIONAL
  const parameters: any[] = [];
  if (sortedKeys.length > 0) {
    for (const k of sortedKeys) {
      const field = variaveis[k] || '';
      const value =
        resolveVar(field, cliente) ||
        resolveNamedVar(field.replace(/[{}]/g, ''), cliente) ||
        'cliente';
      parameters.push({ type: 'text', text: value });
    }
    return { parameters, format: 'positional' };
  }

  const source = positionalMatches.length > 0 ? positionalMatches : namedMatches;
  const seen = new Set<string>();
  for (const m of source) {
    const key = m[1];
    if (seen.has(key)) continue;
    seen.add(key);
    const value = resolveNamedVar(key, cliente) || 'cliente';
    parameters.push({ type: 'text', text: value && value.trim() !== '' ? value : 'cliente' });
  }
  return { parameters, format: 'positional' };
}

function getTemplateComponents(template: any): any[] {
  const components = template?.variaveis?._components;
  return Array.isArray(components) ? components : [];
}

function getHeaderFormat(template: any): string {
  const header = getTemplateComponents(template).find((c: any) => c?.type === 'HEADER');
  return String(header?.format || template?.variaveis?._header_format || '').toUpperCase();
}

function buildMetaComponents(template: any, bodyParameters: any[]) {
  const components: any[] = [];
  const headerFormat = getHeaderFormat(template);

  if (headerFormat === 'IMAGE') {
    const imageUrl = template?.variaveis?._header_image_url || DEFAULT_HEADER_IMAGE_URL;
    components.push({
      type: 'header',
      parameters: [{ type: 'image', image: { link: imageUrl } }],
    });
  } else if (headerFormat === 'VIDEO' || headerFormat === 'DOCUMENT') {
    throw new Error(`Template exige cabeçalho ${headerFormat}. Configure uma mídia pública para este template antes de enviar.`);
  }

  if (bodyParameters.length) components.push({ type: 'body', parameters: bodyParameters });
  return components;
}

async function postMeta(_inst: any, template: any, parameters: any[]) {
  const body: any = {
    messaging_product: 'whatsapp',
    to: undefined as any,
    type: 'template',
    template: {
      name: template.nome_template,
      language: { code: template.idioma || 'pt_BR' },
      components: buildMetaComponents(template, parameters),
    },
  };
  return body;
}

async function sendOne(inst: any, template: any, cliente: ClienteData): Promise<{ waId: string | null; formatUsed: 'named' | 'positional' | 'none' }> {
  const variaveis = (template.variaveis || {}) as Record<string, string>;
  const preferred: 'named' | 'positional' | undefined =
    variaveis._format === 'named' || variaveis._format === 'positional' ? variaveis._format : undefined;

  const formatsToTry: (('named' | 'positional') | undefined)[] = preferred
    ? [preferred, preferred === 'named' ? 'positional' : 'named']
    : [undefined, 'named', 'positional'];

  let lastErr: any = null;
  const triedKeys = new Set<string>();

  for (const fmt of formatsToTry) {
    const { parameters, format } = buildParameters(template, cliente, fmt);
    const key = `${format}:${JSON.stringify(parameters)}`;
    if (triedKeys.has(key)) continue;
    triedKeys.add(key);

    const body = await postMeta(inst, template, parameters);
    body.to = formatTelefone(cliente.telefone);

    console.log(`[Meta] tentando template=${template.nome_template} header=${getHeaderFormat(template) || 'NONE'} format=${format} params=${JSON.stringify(parameters)}`);

    const res = await fetch(`https://graph.facebook.com/v21.0/${inst.phone_number_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${inst.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`[Meta] OK format=${format} waId=${data?.messages?.[0]?.id}`);
      return { waId: data?.messages?.[0]?.id || null, formatUsed: format === 'none' ? (preferred || 'positional') : format };
    }
    lastErr = data?.error;
    const code = data?.error?.code;
    const details = data?.error?.error_data?.details || '';
    console.error(`[Meta] erro code=${code} msg=${data?.error?.message} details=${details}`);

    // mismatch de formato/quantidade/param inválido → tenta próximo formato
    if (code !== 132012 && code !== 132000 && code !== 100) {
      throw new Error(`(#${code}) ${data?.error?.message || 'Falha Meta API'}${details ? ' | ' + details : ''}`);
    }
  }
  const code = lastErr?.code;
  const details = lastErr?.error_data?.details || '';
  throw new Error(`(#${code}) ${lastErr?.message || 'Falha Meta API'}${details ? ' | ' + details : ''}`);
}


Deno.serve(async (req) => {
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
        const { waId, formatUsed } = await sendOne(inst, template, cliente);
        enviados++;
        inst.enviados_hoje = (inst.enviados_hoje || 0) + 1;
        await supabase.from('meta_whatsapp_instances')
          .update({ enviados_hoje: inst.enviados_hoje }).eq('id', inst.id);

        // Persist successful format on template to skip retries next time
        const currentVars = (template.variaveis || {}) as Record<string, any>;
        if (currentVars._format !== formatUsed && formatUsed !== 'none') {
          const newVars = { ...currentVars, _format: formatUsed };
          await supabase.from('meta_whatsapp_templates')
            .update({ variaveis: newVars }).eq('id', template.id);
          template.variaveis = newVars;
        }

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
