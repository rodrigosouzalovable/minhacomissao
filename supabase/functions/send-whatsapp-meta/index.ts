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
  vars?: Record<string, string>;
}

const formatPrimeiroNome = (nome: string): string => {
  if (!nome) return '';
  const p = nome.trim().split(/\s+/)[0].toLowerCase();
  return p.charAt(0).toUpperCase() + p.slice(1);
};
const fmtBRL = (v: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

function normalizeDoc(value?: string | number | null): string {
  const d = String(value ?? '').replace(/\D/g, '');
  return d.length === 11 || d.length === 14 ? d : '';
}

function getCpfCnpj(c: ClienteData): string {
  return normalizeDoc(c.cpf) || normalizeDoc(c.nome);
}

function normalizeCliente(c: ClienteData): ClienteData {
  const cpf = getCpfCnpj(c);
  const nomeLooksLikeDoc = !!normalizeDoc(c.nome);
  return {
    ...c,
    cpf: cpf || c.cpf,
    nome: nomeLooksLikeDoc && !normalizeDoc(c.cpf) ? '' : c.nome,
  };
}

function resolveVar(field: string, c: ClienteData): string {
  switch (field) {
    case '{nome}': return (c.nome || '').trim();
    case '{primeiro_nome}': return formatPrimeiroNome(c.nome || '');
    case '{cpf}': return getCpfCnpj(c);
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
  if (n === 'cpf') return getCpfCnpj(c);
  if (n === 'atraso' || n === 'delay') return String(c.atraso ?? '');
  if (n === 'saldo' || n === 'valor' || n === 'value') return fmtBRL(Number(c.saldo || 0));
  if (n === 'avista') return fmtBRL(Number(c.saldo || 0) * 0.5);
  return resolveVar(`{${n}}`, c) || ' ';
}

function inferFieldForPlaceholder(template: any, key: string): string {
  const bodyText = String(template?.body_text || '');
  // Pega SOMENTE o rótulo imediato: texto entre o }} anterior (ou início) e o {{n}} atual.
  // Assim {{2}} em "Olá {{1}}! O CNPJ {{2}}" vê apenas "! O CNPJ " — sem contaminar com "Olá" do {{1}}.
  const phRx = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`);
  const idx = bodyText.search(phRx);
  let before = '';
  let after = '';
  if (idx >= 0) {
    const chunk = bodyText.slice(0, idx);
    const lastClose = chunk.lastIndexOf('}}');
    before = (lastClose >= 0 ? chunk.slice(lastClose + 2) : chunk).toLowerCase();
    const match = bodyText.slice(idx).match(phRx);
    const restStart = idx + (match ? match[0].length : 0);
    after = bodyText.slice(restStart, restStart + 3).toLowerCase();
  }
  const context = `${before} ${after}`;
  // Ordem: documentos ANTES de saudações, para casos como "Olá {{1}}! O CNPJ {{2}}".
  if (/cnpj|cpf|documento|\bdoc\b/.test(context)) return '{cpf}';
  if (/atraso|dias/.test(context)) return '{atraso}';
  if (/saldo|valor|d[ií]vida|montante|total/.test(context)) return '{saldo}';
  if (/(^|[^a-z])(ol[áa]|prezad[oa]|sr\.?|sra\.?|caro|nome|cliente|primeiro_nome)([^a-z]|$)/.test(context)) return '{nome}';
  // Fallback por posição — convenção mais comum em templates de cobrança/validação.
  if (key === '1') return '{nome}';
  if (key === '2') return '{cpf}';
  if (key === '3') return '{saldo}';
  return '';
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

  const rowVars = (cliente.vars || {}) as Record<string, string>;
  const hasRowVar = (k: string) => typeof rowVars[k] === 'string' && rowVars[k].trim() !== '';

  if (useNamed) {
    const seen = new Set<string>();
    const parameters: any[] = [];
    for (const m of namedMatches) {
      const key = m[1];
      if (seen.has(key)) continue;
      seen.add(key);
      const value = hasRowVar(key)
        ? rowVars[key]
        : (resolveNamedVar(key, cliente) || 'cliente');
      parameters.push({ type: 'text', parameter_name: key, text: value });
    }
    if (parameters.length === 0 && positionalMatches.length > 0) {
      const seen2 = new Set<string>();
      for (const m of positionalMatches) {
        const k = m[1];
        if (seen2.has(k)) continue;
        seen2.add(k);
        const field = variaveis[k] || inferFieldForPlaceholder(template, k) || 'name';
        const value = hasRowVar(k)
          ? rowVars[k]
          : (resolveNamedVar(field.replace(/[{}]/g, ''), cliente) || 'cliente');
        parameters.push({ type: 'text', parameter_name: field.replace(/[{}]/g, '') || 'name', text: value });
      }
    }
    return { parameters, format: 'named' };
  }

  const parameters: any[] = [];
  if (sortedKeys.length > 0) {
    for (const k of sortedKeys) {
      const field = variaveis[k] || inferFieldForPlaceholder(template, k) || '';
      const value = hasRowVar(k)
        ? rowVars[k]
        : (resolveVar(field, cliente) ||
           resolveNamedVar(field.replace(/[{}]/g, ''), cliente) ||
           'cliente');
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
    const value = hasRowVar(key) ? rowVars[key] : (resolveNamedVar(key, cliente) || 'cliente');
    parameters.push({ type: 'text', text: value && value.trim() !== '' ? value : 'cliente' });
  }
  return { parameters, format: 'positional' };
}

function getTemplateComponents(template: any): any[] {
  const components = template?.variaveis?._components;
  return Array.isArray(components) ? components : [];
}

function getHeaderFormat(template: any): string {
  const components = getTemplateComponents(template);
  const header = components.find((c: any) => c?.type === 'HEADER');
  if (header) return String(header.format || '').toUpperCase();
  // Components conhecidos e SEM header → não envie parâmetro de header.
  // A Meta rejeita com #132018 ("Template does not contain title component,
  // no parameters allowed"). _header_format só vale como fallback quando não
  // conhecemos os components deste template.
  if (components.length > 0) return '';
  return String(template?.variaveis?._header_format || '').toUpperCase();
}


function buildMetaComponents(template: any, bodyParameters: any[], headerMediaId?: string | null) {
  const components: any[] = [];
  const headerFormat = getHeaderFormat(template);

  if (headerFormat === 'IMAGE') {
    const imageUrl = template?.variaveis?._header_image_url;
    if (!imageUrl && !headerMediaId) {
      throw new Error(
        `Template "${template.nome_template}" exige header IMAGE mas não tem _header_image_url configurada.`,
      );
    }
    components.push({
      type: 'header',
      parameters: [{
        type: 'image',
        image: headerMediaId ? { id: headerMediaId } : { link: imageUrl },
      }],
    });
  } else if (headerFormat === 'VIDEO' || headerFormat === 'DOCUMENT') {
    throw new Error(`Template exige cabeçalho ${headerFormat}. Configure uma mídia pública antes de enviar.`);
  }

  if (bodyParameters.length) components.push({ type: 'body', parameters: bodyParameters });
  return components;
}

// ===== Cache de media_id da Meta (evita #131053 "Media upload error") =====
// A Meta baixa a URL do header em CADA envio quando usamos { link }. Sob rajada,
// ou se a URL expirar/demorar, ela devolve #131053. Subindo a imagem UMA vez para
// /{phone_number_id}/media e reutilizando o id, a Meta não baixa mais nada.
const MEDIA_ID_TTL_MS = 20 * 24 * 60 * 60 * 1000; // ids da Meta duram ~30 dias

function cachedMediaId(template: any, instId: string): string | null {
  const map = (template?.variaveis?._header_media_ids || {}) as Record<string, any>;
  const entry = map[instId];
  if (!entry?.id || !entry?.at) return null;
  if (Date.now() - Date.parse(entry.at) > MEDIA_ID_TTL_MS) return null;
  return String(entry.id);
}

async function persistMediaId(supabase: any, template: any, instId: string, mediaId: string | null) {
  const vars = { ...((template.variaveis || {}) as Record<string, any>) };
  const map = { ...((vars._header_media_ids || {}) as Record<string, any>) };
  if (mediaId) map[instId] = { id: mediaId, at: new Date().toISOString() };
  else delete map[instId];
  vars._header_media_ids = map;
  template.variaveis = vars;
  await supabase.from('meta_whatsapp_templates').update({ variaveis: vars }).eq('id', template.id);
}

async function uploadHeaderMedia(inst: any, imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      console.log('[send-whatsapp-meta] download da imagem do header falhou', res.status);
      return null;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const ct = res.headers.get('content-type') || 'image/jpeg';
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
    const fd = new FormData();
    fd.append('messaging_product', 'whatsapp');
    fd.append('type', ct);
    fd.append('file', new Blob([bytes], { type: ct }), `header.${ext}`);
    const up = await fetch(`https://graph.facebook.com/v21.0/${inst.phone_number_id}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${inst.access_token}` },
      body: fd,
    });
    const j = await up.json().catch(() => ({}));
    if (!up.ok || !j?.id) {
      console.log('[send-whatsapp-meta] upload da mídia para a Meta falhou', up.status, JSON.stringify(j).slice(0, 200));
      return null;
    }
    return String(j.id);
  } catch (e) {
    console.log('[send-whatsapp-meta] uploadHeaderMedia erro:', String(e).slice(0, 200));
    return null;
  }
}

// Resolve o media_id do header (cache → upload). Retorna null se não aplicável/falhou
// (nesse caso o envio cai no fallback { link }).
async function resolveHeaderMediaId(supabase: any, inst: any, template: any): Promise<string | null> {
  if (getHeaderFormat(template) !== 'IMAGE') return null;
  const cached = cachedMediaId(template, inst.id);
  if (cached) return cached;
  const imageUrl = template?.variaveis?._header_image_url;
  if (!imageUrl) return null;
  const id = await uploadHeaderMedia(inst, imageUrl);
  if (id) await persistMediaId(supabase, template, inst.id, id);
  return id;
}

async function sendOne(
  inst: any,
  template: any,
  cliente: ClienteData,
  supabase?: any,
): Promise<{ waId: string | null; formatUsed: 'named' | 'positional' | 'none' }> {
  const variaveis = (template.variaveis || {}) as Record<string, string>;
  const preferred: 'named' | 'positional' | undefined =
    variaveis._format === 'named' || variaveis._format === 'positional' ? variaveis._format : undefined;

  const formatsToTry: (('named' | 'positional') | undefined)[] = preferred
    ? [preferred, preferred === 'named' ? 'positional' : 'named']
    : [undefined, 'named', 'positional'];

  let lastErr: any = null;
  const triedKeys = new Set<string>();

  // media_id do header (evita a Meta baixar a imagem em cada envio → #131053)
  let headerMediaId: string | null = supabase ? await resolveHeaderMediaId(supabase, inst, template) : null;
  let mediaFallbackUsado = false;

  for (const fmt of formatsToTry) {
    const { parameters, format } = buildParameters(template, cliente, fmt);
    const key = `${format}:${headerMediaId || 'link'}:${JSON.stringify(parameters)}`;
    if (triedKeys.has(key)) continue;
    triedKeys.add(key);


    const body: any = {
      messaging_product: 'whatsapp',
      to: formatTelefone(cliente.telefone),
      type: 'template',
      template: {
        name: template.nome_template,
        language: { code: template.idioma || 'pt_BR' },
        components: buildMetaComponents(template, parameters, headerMediaId),
      },
    };

    const res = await fetch(`https://graph.facebook.com/v21.0/${inst.phone_number_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${inst.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { waId: data?.messages?.[0]?.id || null, formatUsed: format === 'none' ? (preferred || 'positional') : format };
    }

    // ===== Detecção de RATE LIMIT / 502 temporário =====
    // A Meta devolve 429/502 com "Rate limit exceeded" e às vezes um "Retry after Xms" no body,
    // ou header Retry-After (em segundos). Extraímos o tempo para pausa automática.
    const msgTxt = String(data?.error?.message || '');
    const codeTxt = String(data?.error?.code || '');
    const traceTxt = String(data?.error?.error_data?.details || data?.error?.fbtrace_id || '');
    const combined = `${msgTxt} ${traceTxt}`;
    const retryAfterHeader = res.headers.get('retry-after') || res.headers.get('Retry-After');
    let retryMs = 0;
    const mBody = combined.match(/retry\s*after\s*(\d+)\s*ms/i);
    const mBodySec = combined.match(/retry\s*after\s*(\d+)\s*s(?:ec)?/i);
    if (mBody) retryMs = Number(mBody[1]);
    else if (mBodySec) retryMs = Number(mBodySec[1]) * 1000;
    else if (retryAfterHeader) retryMs = Number(retryAfterHeader) * 1000;
    const isRateLimit =
      res.status === 429 ||
      (res.status === 502 && /rate\s*limit/i.test(combined)) ||
      /rate\s*limit\s*exceeded/i.test(combined) ||
      codeTxt === '80007' || codeTxt === '131056' || codeTxt === '4';
    if (isRateLimit) {
      const ms = retryMs > 0 ? Math.min(retryMs, 5 * 60_000) : 30_000; // fallback 30s, teto 5min
      throw new Error(`__RATE_LIMIT__:${ms}:(#${codeTxt || res.status}) ${msgTxt || 'Rate limit'}`);
    }
    // 502/503/504 sem indicação de rate limit → transitório da Meta
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error(`__TRANSIENT__:5000:(#${res.status}) ${msgTxt || 'Bad Gateway'}`);
    }

    // ===== #131053 Media upload error =====
    // A Meta não conseguiu baixar/processar a imagem do header.
    // 1) se estávamos usando media_id, invalida o cache e tenta subir de novo;
    // 2) se estávamos usando { link }, tenta uma vez via upload (media_id);
    // 3) se ainda falhar, devolve como transitório para o contato voltar à fila.
    if (codeTxt === '131053' || /media upload error/i.test(combined)) {
      if (!mediaFallbackUsado && supabase) {
        mediaFallbackUsado = true;
        if (headerMediaId) await persistMediaId(supabase, template, inst.id, null);
        headerMediaId = null;
        const novoId = await resolveHeaderMediaId(supabase, inst, template);
        if (novoId) {
          headerMediaId = novoId;
          formatsToTry.push(fmt); // repete o mesmo formato já com o media_id novo
          continue;
        }
      }
      throw new Error(`__TRANSIENT__:4000:(#131053) ${msgTxt || 'Media upload error'}`);
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
    const { template_id, instancia_id, cliente: clienteRaw, user_id, modo_teste, atendente_nome, ignorar_pausa_qualidade, folder_id } = await req.json();
    const cliente = clienteRaw ? normalizeCliente(clienteRaw) : clienteRaw;
    if (!template_id || !instancia_id || !cliente?.telefone) {
      return new Response(JSON.stringify({ success: false, error: 'Parâmetros obrigatórios: template_id, instancia_id, cliente.telefone' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const isTeste = modo_teste === true;

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: template } = await supabase
      .from('meta_whatsapp_templates').select('*').eq('id', template_id).maybeSingle();
    if (!template) throw new Error('Template não encontrado');
    if (template.status !== 'approved') throw new Error('Template não aprovado pela Meta');

    // Fallback: se este template não tem imagem/components cadastrados, herda de
    // qualquer instância irmã (mesmo nome_template + idioma) que já tenha configurado.
    // Evita "Sem imagem configurada" quando só 1 das N instâncias cadastrou a mídia.
    try {
      const vars: any = (template.variaveis || {}) as any;
      const hasImage = typeof vars?._header_image_url === 'string' && vars._header_image_url.trim().length > 0;
      const hasComponents = Array.isArray(vars?._components) && vars._components.length > 0;
      // Se os components deste template já provam que NÃO existe header,
      // não herda imagem/formato de irmãs (evita #132018 na Meta).
      const semHeaderLocal = hasComponents &&
        !vars._components.some((c: any) => c?.type === 'HEADER');
      if (semHeaderLocal) {
        delete vars._header_image_url;
        delete vars._header_format;
        delete vars._header_media_ids;
        (template as any).variaveis = vars;
      } else if (!hasImage || !hasComponents) {
        const { data: siblings } = await supabase
          .from('meta_whatsapp_templates')
          .select('variaveis')
          .eq('nome_template', template.nome_template)
          .eq('idioma', template.idioma)
          .eq('status', 'approved')
          .neq('id', template.id)
          .limit(50);
        for (const s of (siblings || [])) {
          const sv: any = (s as any).variaveis || {};
          if (!hasImage && typeof sv._header_image_url === 'string' && sv._header_image_url.trim()) {
            vars._header_image_url = sv._header_image_url;
          }
          if (!hasComponents && Array.isArray(sv._components) && sv._components.length > 0) {
            vars._components = sv._components;
          }
          if (!vars._header_format && sv._header_format) {
            vars._header_format = sv._header_format;
          }
          const doneImage = typeof vars._header_image_url === 'string' && vars._header_image_url.trim().length > 0;
          const doneComps = Array.isArray(vars._components) && vars._components.length > 0;
          if (doneImage && doneComps) break;
        }
        (template as any).variaveis = vars;
      }

    } catch (e) {
      console.log('[send-whatsapp-meta] fallback header/components falhou:', String(e).slice(0, 200));
    }


    // ===== GUARDRAIL: bloqueio anti-marketing =====
    const categoria = String(template.categoria || '').toUpperCase();
    if (categoria === 'MARKETING') {
      const { data: guard } = await supabase
        .from('meta_billing_guardrail').select('*').eq('id', 1).maybeSingle();
      const bloquear = guard?.bloquear_marketing ?? true;
      if (bloquear) {
        // Notifica admin (idempotente por template + dia)
        try {
          const { notificarAdmin } = await import('../_shared/notificar-admin.ts');
          const chave = `meta_marketing_block_${template.nome_template}_${new Date().toISOString().slice(0,10)}`;
          await notificarAdmin(supabase, {
            tipo: 'meta_marketing_bloqueado',
            mensagem:
              `⚠️ Envio Meta BLOQUEADO\n\n` +
              `Template: *${template.nome_template}*\n` +
              `Categoria: *MARKETING* (custo alto ~US$0,0625/msg)\n` +
              `Usuário: ${user_id || 'desconhecido'}\n` +
              `Instância: ${instancia_id}\n\n` +
              `Bloqueado pela trava anti-gasto. Para liberar: Configurar Meta → Segurança de Custos.`,
            chaveIdempotencia: chave,
          });
        } catch (e) {
          console.log('[guardrail] notificarAdmin falhou:', String(e).slice(0, 200));
        }
        return new Response(JSON.stringify({
          success: false,
          error: `Envio bloqueado: template "${template.nome_template}" é categoria MARKETING. Trava anti-gasto ativa. Admin foi notificado.`,
          blocked_marketing: true,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const { data: inst } = await supabase
      .from('meta_whatsapp_instances').select('*').eq('id', instancia_id).eq('ativo', true).maybeSingle();
    if (!inst) throw new Error('Instância Meta não encontrada/ativa');

    // ===== Pool checks =====
    const { data: cfg } = await supabase.from('meta_envio_pool_config').select('*').eq('id', 1).maybeSingle();

    // Se o chamador (burst) pede para ignorar pausas por qualidade, só bloqueamos quando
    // o motivo da pausa/restrição for de fato um status Meta (BANNED/FLAGGED/RESTRICTED).
    const motivoPausaLower = String(inst.pausa_automatica_motivo || '').toLowerCase();
    const pausaPorStatus = motivoPausaLower.startsWith('status=');
    const pausaPorQualidade = motivoPausaLower.startsWith('quality=');
    const ignoraQualidade = ignorar_pausa_qualidade === true;

    if (inst.estado_pool && inst.estado_pool !== 'ativo' && !isTeste) {
      // Estado 'restrita' sempre bloqueia. 'pausado' por qualidade é ignorado no modo rajada.
      const bloqueiaEstado = inst.estado_pool === 'restrita' || !(ignoraQualidade && pausaPorQualidade);
      if (bloqueiaEstado) {
        return new Response(JSON.stringify({
          success: false, error: `Instância não está ativa no pool (estado: ${inst.estado_pool})`,
          pool_blocked: true, instancia_id,
          instance_restricted: inst.estado_pool === 'restrita' || pausaPorStatus,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }
    if (inst.pausa_automatica_ate && new Date(inst.pausa_automatica_ate) > new Date()) {
      const bloqueiaPausa = !(ignoraQualidade && pausaPorQualidade);
      if (bloqueiaPausa) {
        return new Response(JSON.stringify({
          success: false, error: `Pausa automática até ${new Date(inst.pausa_automatica_ate).toLocaleString('pt-BR')} — motivo: ${inst.pausa_automatica_motivo || 'não informado'}`,
          pool_paused: true, instancia_id,
          instance_restricted: pausaPorStatus,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Bloqueio de domingo/horário desativado: envios liberados em qualquer dia/horário.


    // Reset diário
    const today = new Date().toISOString().slice(0, 10);
    if (inst.ultimo_reset !== today) {
      await supabase.from('meta_whatsapp_instances').update({
        enviados_hoje: 0, ultimo_reset: today,
      }).eq('id', inst.id);
      inst.enviados_hoje = 0; inst.ultimo_reset = today;
    }

    // Cotas de ramp-up removidas: o usuário controla volume via delay e planilha.
    // Bloqueios reais (pool/pausa/qualidade/horário/domingo) permanecem acima.

    try {
      const { waId, formatUsed } = await sendOne(inst, template, cliente, supabase);
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
        let tel = formatTelefone(cliente.telefone);
        // Canonicaliza pelo sufixo de 8 dígitos para reaproveitar contato existente
        if (tel && tel.length >= 8) {
          const sufixo = tel.slice(-8);
          const { data: canon } = await supabase
            .from('meta_whatsapp_contatos')
            .select('telefone')
            .eq('instancia_id', inst.id)
            .ilike('telefone', `%${sufixo}`)
            .neq('telefone', tel)
            .order('atualizado_em', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (canon?.telefone) tel = canon.telefone;
        }
        const nowIso = new Date().toISOString();

        // Renderiza o corpo real do template com as variáveis substituídas
        let bodyRendered: string = template.body_text || '';
        const variaveis = (template.variaveis || {}) as Record<string, string>;
        const rowVars = (cliente.vars || {}) as Record<string, string>;
        const rowHas = (k: string) => typeof rowVars[k] === 'string' && rowVars[k].trim() !== '';
        // Substitui {{1}}, {{2}}... — prioriza valor por linha vindo da planilha
        bodyRendered = bodyRendered.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, k) => {
          if (rowHas(k)) return rowVars[k];
          const field = variaveis[k] || inferFieldForPlaceholder(template, k) || '';
          return (
            resolveVar(field, cliente) ||
            resolveNamedVar(field.replace(/[{}]/g, ''), cliente) ||
            (cliente.nome || 'cliente')
          );
        });
        // Substitui {{nome}}, {{primeiro_nome}}, etc. (nomeadas)
        bodyRendered = bodyRendered.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_m, k) =>
          rowHas(k) ? rowVars[k] : (resolveNamedVar(k, cliente) || (cliente.nome || 'cliente')),
        );

        const headerFormat = getHeaderFormat(template);
        const headerImageUrl = headerFormat === 'IMAGE' ? (template?.variaveis?._header_image_url || null) : null;
        const tipoConteudo = headerImageUrl ? 'imagem' : 'texto';
        const previewBody = bodyRendered || `[Template: ${template.nome_template}]`;
        const atendenteNome = String(atendente_nome || '').trim();
        const preview = atendenteNome && !/^\*Atendente\s/i.test(previewBody)
          ? `*Atendente ${atendenteNome}:*\n\n${previewBody}`
          : previewBody;

        // Extrai botões do template (armazenados em variaveis._components) para exibir no Inbox
        let templateBotoes: any[] | null = null;
        try {
          const comps = (template?.variaveis?._components || []) as any[];
          const btnComp = Array.isArray(comps) ? comps.find((c) => String(c?.type || '').toUpperCase() === 'BUTTONS') : null;
          if (btnComp && Array.isArray(btnComp.buttons) && btnComp.buttons.length > 0) {
            templateBotoes = btnComp.buttons.map((b: any) => ({
              type: String(b?.type || '').toUpperCase(),
              text: b?.text || '',
              url: b?.url || undefined,
              phone_number: b?.phone_number || undefined,
            }));
          }
        } catch { /* ignore */ }

        await supabase.from('meta_whatsapp_mensagens').insert({
          user_id: user_id || inst.user_id,
          instancia_id: inst.id,
          telefone: tel,
          direcao: 'saida',
          conteudo: preview,
          tipo_conteudo: tipoConteudo,
          media_url: headerImageUrl,
          timestamp_msg: nowIso,
          status_envio: 'enviada',
          wa_message_id: waId,
          template_nome: template.nome_template,
          template_botoes: templateBotoes,
        } as any);
        let contatoIdFinal: string | null = null;
        const { data: ex } = await supabase
          .from('meta_whatsapp_contatos')
          .select('id')
          .eq('instancia_id', inst.id)
          .eq('telefone', tel)
          .maybeSingle();
        if (ex) {
          contatoIdFinal = (ex as any).id;
          const updContato: any = {
            ultima_mensagem: preview,
            ultima_mensagem_em: nowIso,
            atualizado_em: nowIso,
            // Novo envio reativa a conversa na lista principal
            arquivado: false,
          };
          if (folder_id) updContato.folder_id = folder_id;
          await supabase.from('meta_whatsapp_contatos').update(updContato).eq('id', ex.id);
        } else {
          const { data: novo } = await supabase.from('meta_whatsapp_contatos').insert({
            user_id: user_id || inst.user_id,
            instancia_id: inst.id,
            telefone: tel,
            nome: (cliente.nome || '').trim() || null,
            ultima_mensagem: preview,
            ultima_mensagem_em: nowIso,
            folder_id: folder_id || null,
          } as any).select('id').maybeSingle();
          contatoIdFinal = (novo as any)?.id ?? null;
        }

        // Aplicar etiqueta "Atendente: {nome}%" ao contato — APENAS se já existir.
        // Vale o ATENDENTE NOMEADO na mensagem, não o remetente técnico do disparo.
        if (atendenteNome && contatoIdFinal) {
          await aplicarEtiquetaAtendente(supabase, {
            contatoId: contatoIdFinal,
            atendenteNome,
            ownerUserId: inst.user_id,
            logPrefix: '[send-whatsapp-meta]',
          });
        }

      } catch (_) { /* não bloqueia o envio */ }



      return new Response(JSON.stringify({ success: true, waId, instancia_id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'erro';

      // ===== Rate limit da Meta: NÃO conta como erro fatal, NÃO restringe instância =====
      const rlMatch = msg.match(/^__RATE_LIMIT__:(\d+):(.*)$/s);
      if (rlMatch) {
        const retryAfterMs = Number(rlMatch[1]);
        const humanMsg = rlMatch[2];
        // Marca a instância como pausada por rate limit até o tempo indicado
        try {
          await supabase.from('meta_whatsapp_instances').update({
            rate_limit_ate: new Date(Date.now() + retryAfterMs).toISOString(),
            rajada_taxa_atual: 1,
            rajada_ultimo_ajuste_em: new Date().toISOString(),
          }).eq('id', inst.id);
        } catch { /* ignora */ }
        return new Response(JSON.stringify({
          success: false,
          rate_limited: true,
          retry_after_ms: retryAfterMs,
          error: humanMsg,
          instancia_id,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const trMatch = msg.match(/^__TRANSIENT__:(\d+):(.*)$/s);
      if (trMatch) {
        return new Response(JSON.stringify({
          success: false,
          transient: true,
          retry_after_ms: Number(trMatch[1]),
          error: trMatch[2],
          instancia_id,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      await supabase.from('meta_whatsapp_envios_log').insert({
        instancia_id: inst.id,
        user_id: user_id || inst.user_id,
        telefone: formatTelefone(cliente.telefone),
        template_nome: template.nome_template,
        status: 'failed',
        erro: msg,
      });

      // Detecta template PAUSADO pela Meta (#132015) — não é problema da instância
      const isTemplatePaused =
        msg.includes('#132015') ||
        /template is (?:temporarily )?unavailable|is paused|paused due to low quality/i.test(msg);
      if (isTemplatePaused) {
        return new Response(JSON.stringify({
          success: false,
          template_paused: true,
          instance_disable: true,
          error: 'O template está pausado pela Meta. Escolha outro template ou aguarde a liberação.',
          detalhe: msg,
          instancia_id,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Detecta bloqueio/restrição/banimento síncrono da Meta
      const restrictedCodes = [
        131031, 131049, 368, 130429,
        131042, 131050,
        133000, 133004, 133005, 133006, 133008, 133009, 133010, 133016,
        190, 10, 200, 803,
      ];
      const lower = msg.toLowerCase();
      const restrictedKeywords = [
        'locked', 'restrict', 'banned', 'disabled', 'bloquead', 'bloqueio',
        'eligibility', 'payment', 'billing', 'not verified',
        'permission', 'does not exist', 'cannot be loaded',
        'two-step', 'pin locked', 'access token',
      ];
      const isRestricted =
        restrictedCodes.some((c) => msg.includes(`#${c}`)) ||
        restrictedKeywords.some((k) => lower.includes(k));

      if (isRestricted) {
        const ate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await supabase.from('meta_whatsapp_instances').update({
          estado_pool: 'restrita',
          pausa_automatica_ate: ate,
          pausa_automatica_motivo: msg.slice(0, 200),
        }).eq('id', inst.id);

        try {
          const { notificarAdmin } = await import('../_shared/notificar-admin.ts');
          const chave = `meta_instancia_restrita_${inst.id}_${new Date().toISOString().slice(0, 10)}`;
          await notificarAdmin(supabase, {
            tipo: 'meta_instancia_restrita',
            mensagem:
              `🚫 Instância Meta restringida/bloqueada\n\n` +
              `Instância: *${inst.nome || inst.display_phone || inst.id}*\n` +
              `Motivo: *${msg}*\n\n` +
              `Pausa automática por 24h. Verifique o Business Manager da Meta.`,
            chaveIdempotencia: chave,
          });
        } catch (_) { /* ignore */ }

        return new Response(JSON.stringify({
          success: false,
          instance_restricted: true,
          error: `Instância restringida/banida pela Meta: ${msg}`,
          instancia_id,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

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
