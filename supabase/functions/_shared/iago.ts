// Helpers compartilhados do atendente de IA "IAGO".
// Usado por iago-atendimento, iago-followup-tick e iago-aprender.
import { notificarAdmin } from './notificar-admin.ts';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

export const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

export const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');
export const sufixo8 = (v: unknown) => soDigitos(v).slice(-8);

export const primeiroNome = (nome?: string | null) => {
  const p = String(nome || '').trim().split(/\s+/)[0] || '';
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : '';
};

export const cpfFormatado = (cpf: string) => {
  const d = soDigitos(cpf);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return d;
};

export function agoraSP(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const NOME_IAGO = 'IAGO RIBEIRO DE SOUZA';
export const ETIQUETA_HUMANO = 'Aguardando Humano';

/** Cliente pediu para não ser mais contatado => IAGO fica em silêncio para sempre. */
export function ehOptOut(texto: string): boolean {
  const t = String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /(bloquear\s*contato|bloquear|me\s*bloqueia|nao\s*quero\s*mais\s*receber|nao\s*quero\s*receber|sair\s*da\s*lista|descadastr|para\s*de\s*me\s*mandar|pare\s*de\s*me\s*enviar|remover\s*meu\s*numero)/.test(t);
}

/** Extrai CPF/CNPJ tolerando máscara e texto ao redor. */
export function extrairDoc(texto: string): string {
  const t = String(texto || '');
  const candidatos = t.match(/(?:\d[\s.\-\/]*){11,14}/g) || [];
  for (const c of candidatos) {
    const d = soDigitos(c);
    if (d.length === 11 || d.length === 14) return d;
  }
  const todos = soDigitos(t);
  if (todos.length === 11 || todos.length === 14) return todos;
  return '';
}

export async function carregarConfig(supabase: any) {
  const { data } = await supabase.from('iago_config').select('*').order('created_at').limit(1).maybeSingle();
  return data;
}

/** Perfil do IAGO (por config.user_id ou pelo nome). */
export async function perfilIago(supabase: any, cfg: any) {
  if (cfg?.user_id) {
    const { data } = await supabase.from('profiles').select('id, nome').eq('id', cfg.user_id).maybeSingle();
    if (data) return data;
  }
  const { data } = await supabase
    .from('profiles')
    .select('id, nome')
    .ilike('nome', '%iago%')
    .order('criado_em')
    .limit(1)
    .maybeSingle();
  return data;
}

/** IAGO é responsável pela caixa da conversa? */
export async function iagoAtendeCaixa(supabase: any, iagoUserId: string, folderId: string | null) {
  if (folderId) {
    const { data } = await supabase
      .from('meta_inbox_folder_members')
      .select('user_id')
      .eq('folder_id', folderId)
      .eq('user_id', iagoUserId)
      .maybeSingle();
    return !!data;
  }
  const { data } = await supabase
    .from('meta_inbox_default_members')
    .select('user_id')
    .eq('user_id', iagoUserId)
    .maybeSingle();
  return !!data;
}

/** Etiquetas de atendente aplicadas ao contato. */
export async function etiquetasAtendente(supabase: any, contatoId: string): Promise<string[]> {
  const { data } = await supabase
    .from('meta_whatsapp_contato_etiquetas')
    .select('meta_whatsapp_etiquetas(nome)')
    .eq('contato_id', contatoId);
  return (data || [])
    .map((r: any) => String(r?.meta_whatsapp_etiquetas?.nome || ''))
    .filter((n: string) => /^atendente:/i.test(n));
}

export async function etiquetarAguardandoHumano(supabase: any, contatoId: string) {
  try {
    let { data: et } = await supabase
      .from('meta_whatsapp_etiquetas')
      .select('id')
      .ilike('nome', ETIQUETA_HUMANO)
      .limit(1)
      .maybeSingle();

    if (!et) {
      const { data: adminRole } = await supabase
        .from('user_roles').select('user_id').eq('role', 'admin').limit(1).maybeSingle();
      const { data: nova } = await supabase
        .from('meta_whatsapp_etiquetas')
        .insert({ nome: ETIQUETA_HUMANO, cor: '#F59E0B', user_id: (adminRole as any)?.user_id, ativa: true })
        .select('id').maybeSingle();
      et = nova;
    }
    if (!et?.id) return;

    await supabase.from('meta_whatsapp_contato_etiquetas').upsert(
      { contato_id: contatoId, etiqueta_id: (et as any).id, origem: 'manual' },
      { onConflict: 'contato_id,etiqueta_id', ignoreDuplicates: true },
    );
  } catch (e: any) {
    console.error('[IAGO] falha ao etiquetar Aguardando Humano', e?.message || e);
  }
}

export async function avisarEmergencia(supabase: any, mensagem: string, contatoId?: string) {
  if (contatoId) await etiquetarAguardandoHumano(supabase, contatoId);

  const { data: contatos } = await supabase
    .from('meta_ia_contatos_emergencia').select('telefone').eq('ativo', true);
  const destinatarios = (contatos || [])
    .map((c: any) => soDigitos(c.telefone))
    .filter((t: string) => t.length >= 10);

  if (!destinatarios.length) {
    console.error('[IAGO] nenhum contato de emergência ativo');
    return { success: false, error: 'sem_contato_emergencia' };
  }
  const res = await notificarAdmin(supabase, { tipo: 'iago_humano', mensagem, destinatarios });
  if (!res.success) console.error('[IAGO] falha ao avisar emergência', (res as any).error || (res as any).skipped);
  return res;
}

export async function enviarTexto(
  supabase: any,
  contato: any,
  texto: string,
): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('send-whatsapp-meta-text', {
    body: {
      instancia_id: contato.instancia_id,
      telefone: contato.telefone || undefined,
      bsuid: contato.bsuid || undefined,
      texto,
      origem: 'ia',
    },
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'falha no envio');
  return (data as any)?.mensagem_id || null;
}

/** Resolve o CPF do cliente pelo telefone (sufixo de 8 dígitos). */
export async function resolverCpfPorTelefone(supabase: any, telefone: string | null): Promise<string> {
  const suf = sufixo8(telefone);
  if (suf.length !== 8) return '';
  const { data: devs } = await supabase
    .from('devedores').select('cpf').eq('ativo', true)
    .ilike('telefone', `%${suf}`).order('criado_em', { ascending: false }).limit(1);
  if ((devs || []).length) return soDigitos((devs as any)[0].cpf);

  const { data: tels } = await supabase
    .from('devedor_telefones').select('devedor_cpf').eq('ativo', true)
    .ilike('numero', `%${suf}`).limit(1);
  if ((tels || []).length) return soDigitos((tels as any)[0].devedor_cpf);
  return '';
}

export interface PropostaCalculada {
  total: number;
  credor: string;
  nomeCliente: string;
  valorAvista: number;
  descAvistaPct: number;
  descParceladoPct: number;
  opcoes: Array<{ parcelas: number; valorParcela: number }>;
  totalParcelado: number;
}

/** Calcula a proposta usando as regras do sistema (nunca a IA). */
export async function calcularProposta(supabase: any, cpf: string): Promise<PropostaCalculada | null> {
  const { data: iaCfgs } = await supabase.from('meta_ia_config').select('*');
  const iaCfg = (iaCfgs || [])[0] || {};
  const descAvista = Number(iaCfg.desconto_avista_pct ?? 50);
  const descParc = Number(iaCfg.desconto_parcelado_pct ?? 30);
  const maxParc = Number(iaCfg.max_parcelas ?? 24);
  const parcMin = Number(iaCfg.parcela_minima ?? 100);

  const { data: debitos } = await supabase.rpc('consultar_debitos_por_cpf', { p_cpf: cpf });
  const lista = (debitos || []) as any[];
  if (!lista.length) return null;

  const total = lista.reduce((s, d) => s + Number(d.valor_atualizado || d.valor_original || 0), 0);
  const valorParcelado = total * (1 - descParc / 100);

  const GRADE = [4, 8, 12, 16, 20, 24];
  let ns = GRADE.filter((n) => n <= maxParc && valorParcelado / n >= parcMin);
  if (!ns.length) {
    for (let i = Math.min(maxParc, 24); i >= 2; i--) {
      if (valorParcelado / i >= parcMin) { ns = [i]; break; }
    }
  }
  const opcoes = ns.length
    ? ns.map((n) => ({ parcelas: n, valorParcela: valorParcelado / n }))
    : [{ parcelas: 1, valorParcela: valorParcelado }];

  return {
    total,
    credor: String(lista[0]?.credor || 'o credor'),
    nomeCliente: String(lista[0]?.nome || ''),
    valorAvista: total * (1 - descAvista / 100),
    descAvistaPct: descAvista,
    descParceladoPct: descParc,
    opcoes,
    totalParcelado: valorParcelado,
  };
}

/** Chamada ao Lovable AI Gateway. Retorna o texto da resposta. */
export async function chamarIA(
  system: string,
  user: string,
  modelo = 'google/gemini-3.6-flash',
): Promise<string> {
  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) throw new Error('LOVABLE_API_KEY não configurada');
  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key },
    body: JSON.stringify({ model: modelo, messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ] }),
  });
  if (res.status === 429) throw new Error('rate_limit');
  if (res.status === 402) throw new Error('sem_creditos');
  if (!res.ok) throw new Error(`ai_${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return String(data?.choices?.[0]?.message?.content || '');
}

export function extrairJson(txt: string): any {
  const bloco = txt.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const cru = bloco ? bloco[1] : txt;
  const ini = cru.indexOf('{');
  const fim = cru.lastIndexOf('}');
  if (ini < 0 || fim < ini) return null;
  try { return JSON.parse(cru.slice(ini, fim + 1)); } catch { return null; }
}
