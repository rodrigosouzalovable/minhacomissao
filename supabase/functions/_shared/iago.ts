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

/** Cliente avisou que não é a pessoa procurada / número errado. */
export function ehNumeroErrado(texto: string): boolean {
  const t = String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!t.trim()) return false;
  return /(nao\s*(sou|e)\s+(o|a|ele|ela|essa|esse|est[ae])\b|nao\s*sou\s*(eu|essa|esse)\b|nao\s*e\s*(o\s*)?meu\s*(nome|numero)|numero\s*errado|telefone\s*errado|pessoa\s*errada|nao\s*conhe(c|ss)o|errou\s*o\s*numero|(e|foi)\s*engano|numero\s*trocado|nao\s*e\s*comigo|nao\s*mora\s*(mais\s*)?aqui)/.test(t);
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
    .ilike('nome', 'iago%')
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

  // Registro interno (painel/sino) — nunca depende da entrega no WhatsApp
  try {
    await supabase.from('admin_notificacoes_log').insert({
      tipo: 'iago_humano_painel',
      chave_idempotencia: contatoId ? `iago:${contatoId}:${Date.now()}` : null,
      mensagem,
      status: 'interno',
    });
  } catch (e: any) {
    console.error('[IAGO] falha ao registrar aviso interno', e?.message || e);
  }

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

export interface CandidatoTelefone {
  cpf: string;
  nome: string;
  ativo: boolean;
  temAcordo: boolean;
  temDebito: boolean;
}

export interface ResolucaoTelefone {
  cpf: string;
  nome: string;
  candidatos: CandidatoTelefone[];
}

/**
 * Resolve o(s) CPF(s) do cliente pelo telefone (sufixo de 8 dígitos).
 * Fontes: devedor_telefones, devedores e acordos. Prioriza:
 * acordo ativo > débito em aberto > registro ativo > mais recente.
 */
export async function resolverTelefone(supabase: any, telefone: string | null): Promise<ResolucaoTelefone> {
  const vazio: ResolucaoTelefone = { cpf: '', nome: '', candidatos: [] };
  const suf = sufixo8(telefone);
  if (suf.length !== 8) return vazio;

  const mapa = new Map<string, CandidatoTelefone>();
  const push = (cpfRaw: unknown, nome: unknown, ativo: boolean, extra?: Partial<CandidatoTelefone>) => {
    const cpf = soDigitos(cpfRaw);
    if (cpf.length !== 11) return;
    const atual = mapa.get(cpf) || { cpf, nome: '', ativo: false, temAcordo: false, temDebito: false };
    mapa.set(cpf, {
      ...atual,
      nome: atual.nome || String(nome || '').trim(),
      ativo: atual.ativo || ativo,
      temAcordo: atual.temAcordo || !!extra?.temAcordo,
      temDebito: atual.temDebito || !!extra?.temDebito,
    });
  };

  const [tels, devs, acs] = await Promise.all([
    supabase.from('devedor_telefones').select('devedor_cpf, ativo').ilike('numero', `%${suf}`).limit(20),
    supabase.from('devedores').select('cpf, nome, ativo').ilike('telefone', `%${suf}`)
      .order('criado_em', { ascending: false }).limit(40),
    supabase.from('acordos').select('cliente_cpf, cliente_nome').ilike('cliente_telefone', `%${suf}`).limit(20),
  ]);

  for (const t of (tels?.data || []) as any[]) push(t.devedor_cpf, '', t.ativo !== false);
  for (const d of (devs?.data || []) as any[]) {
    push(d.cpf, d.nome, d.ativo !== false, { temDebito: d.ativo !== false });
  }
  for (const a of (acs?.data || []) as any[]) push(a.cliente_cpf, a.cliente_nome, true, { temAcordo: true });

  const candidatos = Array.from(mapa.values());
  if (!candidatos.length) return vazio;

  // Completa nome/débito para CPFs vindos apenas da lista de telefones
  const semNome = candidatos.filter((c) => !c.nome).map((c) => c.cpf);
  if (semNome.length) {
    const { data: extras } = await supabase
      .from('devedores').select('cpf, nome, ativo').in('cpf', semNome).limit(200);
    for (const e of (extras || []) as any[]) {
      const c = mapa.get(soDigitos(e.cpf));
      if (c) {
        c.nome = c.nome || String(e.nome || '').trim();
        c.temDebito = c.temDebito || e.ativo !== false;
      }
    }
  }

  const score = (c: CandidatoTelefone) =>
    (c.temAcordo ? 8 : 0) + (c.temDebito ? 4 : 0) + (c.ativo ? 2 : 0) + (c.nome ? 1 : 0);
  const ordenados = Array.from(mapa.values()).sort((a, b) => score(b) - score(a));
  return { cpf: ordenados[0].cpf, nome: ordenados[0].nome, candidatos: ordenados };
}

/** Compatibilidade: retorna apenas o CPF resolvido. */
export async function resolverCpfPorTelefone(supabase: any, telefone: string | null): Promise<string> {
  const r = await resolverTelefone(supabase, telefone);
  return r.cpf;
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

const normalizeCredor = (v: unknown) =>
  String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();

/** Faixas padrão do portal (dias de atraso da parcela mais antiga). */
function descontoPadrao(dias: number, modalidade: 'avista' | 'parcelado'): number {
  if (dias <= 0) return 0;
  if (dias <= 200) return modalidade === 'avista' ? 10 : 0;
  if (dias <= 300) return modalidade === 'avista' ? 20 : 10;
  if (dias <= 500) return modalidade === 'avista' ? 30 : 20;
  return modalidade === 'avista' ? 50 : 30;
}

/**
 * Calcula a proposta com as MESMAS regras do portal público de negociação:
 * dias de atraso da parcela mais antiga + faixas customizadas do credor
 * (credor_desconto_faixas) com fallback nas faixas padrão. Parcela mínima R$ 100.
 */
export async function calcularProposta(supabase: any, cpf: string): Promise<PropostaCalculada | null> {
  const { data: debitos } = await supabase.rpc('consultar_debitos_por_cpf', { p_cpf: cpf });
  const lista = (debitos || []) as any[];
  if (!lista.length) return null;

  const total = lista.reduce((s, d) => s + Number(d.valor_atualizado || d.valor_original || 0), 0);
  const credor = String(lista[0]?.credor || 'o credor');

  // Dias de atraso da parcela mais antiga
  const ts = lista
    .map((d) => d.data_vencimento)
    .filter(Boolean)
    .map((v: string) => new Date(String(v).slice(0, 10) + 'T00:00:00').getTime())
    .filter((t: number) => !Number.isNaN(t));
  let dias = 0;
  if (ts.length) {
    const hoje = new Date(agoraSP().toDateString()).getTime();
    dias = Math.max(0, Math.floor((hoje - Math.min(...ts)) / 86400000));
  }

  // Faixas customizadas do credor
  const { data: faixas } = await supabase
    .from('credor_desconto_faixas')
    .select('dias_de, dias_ate, desc_avista, desc_parcelado')
    .eq('credor', normalizeCredor(credor))
    .order('dias_de');

  let descAvista: number;
  let descParc: number;
  const lst = (faixas || []) as any[];
  if (lst.length) {
    const hit = lst.find((f) => dias >= (Number(f.dias_de) || 0) && (f.dias_ate == null || dias <= Number(f.dias_ate)));
    descAvista = hit ? Math.max(0, Math.min(100, Number(hit.desc_avista) || 0)) : 0;
    descParc = hit ? Math.max(0, Math.min(100, Number(hit.desc_parcelado) || 0)) : 0;
  } else {
    descAvista = descontoPadrao(dias, 'avista');
    descParc = descontoPadrao(dias, 'parcelado');
  }

  const parcMin = 100;
  const valorParcelado = total * (1 - descParc / 100);

  const GRADE = [2, 4, 8, 12, 16, 20, 24];
  const ns = GRADE.filter((n) => valorParcelado / n >= parcMin);
  const opcoes = ns.map((n) => ({ parcelas: n, valorParcela: valorParcelado / n }));


  return {
    total,
    credor,
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
