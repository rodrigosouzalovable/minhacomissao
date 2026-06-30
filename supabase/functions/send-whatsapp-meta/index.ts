// Envio unitário (1 mensagem por chamada). O loop, delay, pausa e round-robin
// vivem no frontend para permitir pausar/retomar/cancelar sem servidor extra.
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
    case '{nome}': return (c.nome || '').trim();
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
  const full = (c.nome || '').trim();
  if (n === 'primeiro_nome' || n === 'first_name') return formatPrimeiroNome(full) || 'cliente';
  if (n === 'name' || n === 'nome' || n === 'nome_completo' || n === 'full_name') return full || 'cliente';
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
    const imageUrl = template?.variaveis?._header_image_url;
    if (!imageUrl) {
      throw new Error(
        `Template "${template.nome_template}" exige header IMAGE mas não tem _header_image_url configurada.`,
      );
    }
    components.push({
      type: 'header',
      parameters: [{ type: 'image', image: { link: imageUrl } }],
    });
  } else if (headerFormat === 'VIDEO' || headerFormat === 'DOCUMENT') {
    throw new Error(`Template exige cabeçalho ${headerFormat}. Configure uma mídia pública antes de enviar.`);
  }

  if (bodyParameters.length) components.push({ type: 'body', parameters: bodyParameters });
  return components;
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

    const body: any = {
      messaging_product: 'whatsapp',
      to: formatTelefone(cliente.telefone),
      type: 'template',
      template: {
        name: template.nome_template,
        language: { code: template.idioma || 'pt_BR' },
        components: buildMetaComponents(template, parameters),
      },
    };

    const res = await fetch(`https://graph.facebook.com/v21.0/${inst.phone_number_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${inst.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      return { waId: data?.messages?.[0]?.id || null, formatUsed: format === 'none' ? (preferred || 'positional') : format };
    }
    lastErr = data?.error;
    const code = data?.error?.code;
    const details = data?.error?.error_data?.details || '';
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
    const { template_id, instancia_id, cliente, user_id } = await req.json();
    if (!template_id || !instancia_id || !cliente?.telefone) {
      return new Response(JSON.stringify({ success: false, error: 'Parâmetros obrigatórios: template_id, instancia_id, cliente.telefone' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: template } = await supabase
      .from('meta_whatsapp_templates').select('*').eq('id', template_id).maybeSingle();
    if (!template) throw new Error('Template não encontrado');
    if (template.status !== 'approved') throw new Error('Template não aprovado pela Meta');

    const { data: inst } = await supabase
      .from('meta_whatsapp_instances').select('*').eq('id', instancia_id).eq('ativo', true).maybeSingle();
    if (!inst) throw new Error('Instância Meta não encontrada/ativa');

    // Reset diário
    const today = new Date().toISOString().slice(0, 10);
    if (inst.ultimo_reset !== today) {
      await supabase.from('meta_whatsapp_instances').update({
        enviados_hoje: 0, ultimo_reset: today,
      }).eq('id', inst.id);
      inst.enviados_hoje = 0; inst.ultimo_reset = today;
    }

    if ((inst.enviados_hoje || 0) >= (inst.tier_diario || 250)) {
      return new Response(JSON.stringify({ success: false, error: 'Instância atingiu tier_diario', tier_full: true, instancia_id }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const { waId, formatUsed } = await sendOne(inst, template, cliente);
      await supabase.from('meta_whatsapp_instances')
        .update({ enviados_hoje: (inst.enviados_hoje || 0) + 1 }).eq('id', inst.id);

      const currentVars = (template.variaveis || {}) as Record<string, any>;
      if (currentVars._format !== formatUsed && formatUsed !== 'none') {
        await supabase.from('meta_whatsapp_templates')
          .update({ variaveis: { ...currentVars, _format: formatUsed } }).eq('id', template.id);
      }

      await supabase.from('meta_whatsapp_envios_log').insert({
        instancia_id: inst.id,
        user_id: user_id || inst.user_id,
        telefone: formatTelefone(cliente.telefone),
        template_nome: template.nome_template,
        status: 'sent',
        wa_message_id: waId,
      });

      // Espelha o envio no Inbox Meta (mensagem saída + upsert contato)
      try {
        const tel = formatTelefone(cliente.telefone);
        const nowIso = new Date().toISOString();
        const preview = `[Template: ${template.nome_template}]`;
        await supabase.from('meta_whatsapp_mensagens').insert({
          user_id: user_id || inst.user_id,
          instancia_id: inst.id,
          telefone: tel,
          direcao: 'saida',
          conteudo: preview,
          tipo_conteudo: 'texto',
          timestamp_msg: nowIso,
          status_envio: 'enviada',
          wa_message_id: waId,
          template_nome: template.nome_template,
        } as any);
        const { data: ex } = await supabase
          .from('meta_whatsapp_contatos')
          .select('id')
          .eq('instancia_id', inst.id)
          .eq('telefone', tel)
          .maybeSingle();
        if (ex) {
          await supabase.from('meta_whatsapp_contatos').update({
            ultima_mensagem: preview,
            ultima_mensagem_em: nowIso,
            atualizado_em: nowIso,
          }).eq('id', ex.id);
        } else {
          await supabase.from('meta_whatsapp_contatos').insert({
            user_id: user_id || inst.user_id,
            instancia_id: inst.id,
            telefone: tel,
            nome: (cliente.nome || '').trim() || null,
            ultima_mensagem: preview,
            ultima_mensagem_em: nowIso,
          } as any);
        }
      } catch (_) { /* não bloqueia o envio */ }

      return new Response(JSON.stringify({ success: true, waId, instancia_id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'erro';
      await supabase.from('meta_whatsapp_envios_log').insert({
        instancia_id: inst.id,
        user_id: user_id || inst.user_id,
        telefone: formatTelefone(cliente.telefone),
        template_nome: template.nome_template,
        status: 'failed',
        erro: msg,
      });
      return new Response(JSON.stringify({ success: false, error: msg, instancia_id }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
