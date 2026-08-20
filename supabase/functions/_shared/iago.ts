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

const semAcento = (v: unknown) =>
  String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Palavras que denunciam nome de perfil do WhatsApp que NÃO é nome de pessoa. */
const PALAVRAS_NAO_PESSOA = new Set([
  'deus', 'jesus', 'cristo', 'fiel', 'fe', 'senhor', 'gloria', 'amem', 'aleluia', 'abencoado',
  'abencoada', 'deusefiel', 'oficial', 'loja', 'lojas', 'empresa', 'contato', 'atendimento',
  'vendas', 'comercial', 'suporte', 'servicos', 'servico', 'delivery', 'transportes', 'transporte',
  'me', 'mei', 'ltda', 'eireli', 'imoveis', 'auto', 'pecas', 'moveis', 'variedades', 'distribuidora',
  'mercado', 'mercadinho', 'barbearia', 'salao', 'studio', 'estudio', 'clinica', 'construcao',
  'materiais', 'financeira', 'credito', 'consultoria', 'representante', 'trabalho', 'casa',
  'familia', 'amor', 'vida', 'sonho', 'sonhos', 'guerreiro', 'guerreira', 'top', 'zap', 'whats',
  'whatsapp', 'novo', 'nova', 'numero', 'tel', 'telefone', 'cliente', 'admin', 'grupo',
]);

/**
 * Diz se o nome vindo do perfil do WhatsApp (pushName) pode ser tratado como nome real da pessoa.
 * Rejeita frases religiosas, razões sociais, apelidos com símbolos/números e nomes longos.
 */
export function nomePerfilConfiavel(nome?: string | null): boolean {
  const bruto = String(nome || '').trim();
  if (bruto.length < 3 || bruto.length > 40) return false;
  // símbolos, emojis, números ou pontuação => não é nome de pessoa
  if (/[^\p{L}\s.'-]/u.test(bruto)) return false;
  const partes = semAcento(bruto).split(/\s+/).filter(Boolean);
  if (!partes.length || partes.length > 3) return false;
  if (partes.some((p) => PALAVRAS_NAO_PESSOA.has(p))) return false;
  // primeiro nome muito curto (iniciais/abreviações)
  if (partes[0].length < 3) return false;
  return true;
}

const PALAVRAS_NAO_NOME = new Set([
  'sim', 'nao', 'ok', 'okay', 'obrigado', 'obrigada', 'bom', 'boa', 'dia', 'tarde', 'noite',
  'oi', 'ola', 'blz', 'beleza', 'certo', 'entendi', 'quem', 'aqui', 'nada', 'agora', 'depois',
  'boleto', 'pix', 'divida', 'acordo', 'valor', 'parcela', 'cpf', 'pode', 'quero', 'preciso',
  'desempregado', 'ainda', 'talvez', 'moco', 'senhor', 'senhora', 'amigo', 'amiga', 'irmao',
]);

/**
 * Extrai o nome que o cliente informou na mensagem ("meu nome é X", "sou o X", "aqui é X"
 * ou o nome isolado logo depois de perguntarmos). Retorna '' quando não há nome claro.
 */
export function extrairNomeInformado(texto?: string | null): string {
  const bruto = String(texto || '').trim();
  if (!bruto) return '';
  if (/\d/.test(bruto.replace(/\s/g, '')) && soDigitos(bruto).length >= 6) return '';

  const limpar = (v: string) =>
    v.replace(/[^\p{L}\s'-]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .join(' ')
      .trim();

  const validar = (cand: string): string => {
    const nome = limpar(cand);
    if (!nome) return '';
    const partes = semAcento(nome).split(/\s+/);
    if (partes[0].length < 3) return '';
    if (partes.some((p) => PALAVRAS_NAO_NOME.has(p) || PALAVRAS_NAO_PESSOA.has(p))) return '';
    if (nome.length > 40) return '';
    return nome
      .split(/\s+/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(' ');
  };

  const t = semAcento(bruto);
  const padroes = [
    /(?:meu\s+nome\s+(?:e|eh|é)|me\s+chamo|pode\s+me\s+chamar\s+de|aqui\s+(?:e|eh|é)|(?:e|eh|é)\s+(?:o|a)\s+)([a-z\s']{3,40})/,
    /\bsou\s+(?:o|a)\s+([a-z\s']{3,40})/,
    /\bsou\s+([a-z\s']{3,40})/,
  ];
  for (const re of padroes) {
    const m = t.match(re);
    if (m) {
      // reconstrói o trecho original (com acentos) pela posição
      const inicio = t.indexOf(m[1]);
      const original = inicio >= 0 ? bruto.slice(inicio, inicio + m[1].length) : m[1];
      const nome = validar(original);
      if (nome) return nome;
    }
  }

  // Mensagem curta contendo apenas o nome (resposta direta à pergunta)
  const palavras = bruto.split(/\s+/).filter(Boolean);
  if (palavras.length <= 3 && !/[?!]/.test(bruto)) {
    const nome = validar(bruto);
    if (nome) return nome;
  }
  return '';
}

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
export const ETIQUETA_ACORDO_FECHADO = 'ACORDO FECHADO';

/** Cliente pediu para não ser mais contatado => IAGO fica em silêncio para sempre. */
export function ehOptOut(texto: string): boolean {
  const t = String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /(bloquear\s*contato|bloquear|me\s*bloqueia|nao\s*quero\s*mais\s*receber|nao\s*quero\s*receber|sair\s*da\s*lista|descadastr|para\s*de\s*me\s*mandar|pare\s*de\s*me\s*enviar|remover\s*meu\s*numero)/.test(t);
}

/** Cliente avisou que não é a pessoa procurada / número errado. */
export function ehNumeroErrado(texto: string): boolean {
  const t = String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!t.trim()) return false;
  if (/(numero\s*errado|telefone\s*errado|pessoa\s*errada|nao\s*conhe(c|ss)o|errou\s*o\s*numero|(e|foi)\s*engano|numero\s*trocado|nao\s*e\s*comigo|nao\s*mora\s*(mais\s*)?aqui|aqui\s*nao\s*(e|mora)|quem\s*fala\s*nao\s*e|nao\s*e\s*(o\s*)?meu\s*(nome|numero))/.test(t)) return true;
  // Pronomes/artigos clássicos: "nao sou o Sebastiao", "nao sou eu", "nao sou essa pessoa"
  if (/\bnao\s*(sou|e|eh)\s+(o|a|ele|ela|essa|esse|est[ae]|eu|ninguem)\b/.test(t)) return true;
  // "nao sou <nome>" — nome próprio direto, sem artigo
  const m = t.match(/\bnao\s*(?:sou|eh)\s+([a-z]{3,})/);
  if (m) {
    const proibidas = new Set(['possivel', 'para', 'pra', 'isso', 'assim', 'bom', 'certo', 'ruim', 'necessario', 'obrigado', 'obrigada', 'nada', 'nao', 'muito', 'mais', 'agora', 'hoje', 'que', 'porque', 'verdade', 'justo', 'legal', 'caro', 'barato', 'valor', 'devedor', 'cliente', 'seu', 'sua', 'meu', 'minha', 'quem', 'contra', 'ela', 'ele']);
    if (!proibidas.has(m[1])) return true;
  }

  return false;

}

/** Mensagem única de condolências/encerramento quando o cliente informa falecimento. */
export const MSG_FALECIDO =
  'Sinto muito pela perda. Agradeço a informação e peço desculpas pelo incômodo. Vamos registrar aqui e não incomodaremos mais. 🙏';

/** Cliente/familiar avisou que o titular faleceu. */
export function ehFalecido(texto: string): boolean {
  const t = String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!t.trim()) return false;
  if (/\b(falec\w*|faleci\w*|obito|veio\s*a\s*obito|morreu|morre\w*u|ja\s*morreu|e\s*morto|esta\s*morto|morto|morta|sepultad\w*|enterrad\w*|de\s*cujus)\b/.test(t)) return true;
  if (/(descansou\s*em\s*(paz|\d{4})|nao\s*esta\s*mais\s*(entre\s*nos|conosco|aqui\s*com\s*nos)|perdi\s*(meu|minha)\s*(pai|mae|irmao|irma|esposo|esposa|marido|filho|filha|avo|avoa|tio|tia))/.test(t)) return true;
  return false;
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

export interface QualificacaoIA {
  id: string;
  nome: string;
  motivos: { id: string; nome: string }[];
}

/** Qualificações ativas (primárias + motivos ativos) para a IA escolher. */
export async function carregarQualificacoesDisponiveis(supabase: any): Promise<QualificacaoIA[]> {
  const { data } = await supabase
    .from('meta_qualificacoes')
    .select('id, nome, parent_id, ativo, ordem')
    .eq('ativo', true)
    .order('ordem');
  const linhas = (data || []) as any[];
  const primarias = linhas.filter((q) => !q.parent_id);
  return primarias.map((p) => ({
    id: p.id,
    nome: p.nome,
    motivos: linhas.filter((m) => m.parent_id === p.id).map((m) => ({ id: m.id, nome: m.nome })),
  }));
}

const norm = (s: unknown) =>
  String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

/**
 * Aplica a qualificação escolhida pelo IAGO (só nomes já cadastrados e ativos).
 * Substitui a qualificação anterior do contato — ele pode trocar quando a conversa evolui.
 */
export async function qualificarConversa(
  supabase: any,
  contatoId: string,
  iagoUserId: string | null,
  nomeQualificacao: string,
  nomeMotivo?: string,
  disponiveis?: QualificacaoIA[],
) {
  try {
    const alvo = norm(nomeQualificacao);
    if (!contatoId || !alvo) return false;
    const lista = disponiveis ?? (await carregarQualificacoesDisponiveis(supabase));
    const primaria = lista.find((q) => norm(q.nome) === alvo)
      ?? lista.find((q) => norm(q.nome).includes(alvo) || alvo.includes(norm(q.nome)));
    if (!primaria) {
      console.log('[IAGO] qualificação inexistente — ignorando', nomeQualificacao);
      return false;
    }
    const motivo = nomeMotivo
      ? primaria.motivos.find((m) => norm(m.nome) === norm(nomeMotivo))
      : null;
    const ids = [primaria.id, ...(motivo ? [motivo.id] : [])];

    // Remove as qualificações anteriores (permite trocar de qualificação)
    const todosIds = lista.flatMap((q) => [q.id, ...q.motivos.map((m) => m.id)]);
    const remover = todosIds.filter((id) => !ids.includes(id));
    if (remover.length) {
      await supabase.from('meta_contato_qualificacao')
        .delete().eq('contato_id', contatoId).in('qualificacao_id', remover);
    }

    const agora = new Date().toISOString();
    await supabase.from('meta_contato_qualificacao').upsert(
      ids.map((id) => ({
        contato_id: contatoId,
        qualificacao_id: id,
        user_id: iagoUserId,
        updated_at: agora,
      })),
      { onConflict: 'contato_id,qualificacao_id' },
    );
    console.log('[IAGO] qualificou conversa', { contatoId, qualificacao: primaria.nome, motivo: motivo?.nome || null });
    return true;
  } catch (e: any) {
    console.error('[IAGO] falha ao qualificar conversa', e?.message || e);
    return false;
  }
}


/** Aplica a etiqueta existente "ACORDO FECHADO" (nunca cria). */
export async function etiquetarAcordoFechado(supabase: any, contatoId: string) {
  try {
    const { data: et } = await supabase
      .from('meta_whatsapp_etiquetas')
      .select('id')
      .ilike('nome', ETIQUETA_ACORDO_FECHADO)
      .limit(1)
      .maybeSingle();

    if (!et?.id) {
      console.log('[IAGO] etiqueta ACORDO FECHADO inexistente — ignorando');
      return;
    }

    await supabase.from('meta_whatsapp_contato_etiquetas').upsert(
      { contato_id: contatoId, etiqueta_id: (et as any).id, origem: 'manual' },
      { onConflict: 'contato_id,etiqueta_id', ignoreDuplicates: true },
    );
  } catch (e: any) {
    console.error('[IAGO] falha ao etiquetar ACORDO FECHADO', e?.message || e);
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
export async function calcularProposta(
  supabase: any,
  cpf: string,
  override?: { descAvista?: number | null; descParcelado?: number | null },
): Promise<PropostaCalculada | null> {
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

  const clampPct = (v: unknown) =>
    v == null || v === '' || Number.isNaN(Number(v)) ? null : Math.max(0, Math.min(100, Number(v)));
  const ovAvista = clampPct(override?.descAvista);
  const ovParc = clampPct(override?.descParcelado);

  let descAvista: number;
  let descParc: number;

  if (ovAvista != null || ovParc != null) {
    // Descontos definidos manualmente na configuração do IAGO têm prioridade.
    descAvista = ovAvista ?? 0;
    descParc = ovParc ?? 0;
  } else {
    // Faixas customizadas do credor
    const { data: faixas } = await supabase
      .from('credor_desconto_faixas')
      .select('dias_de, dias_ate, desc_avista, desc_parcelado')
      .eq('credor', normalizeCredor(credor))
      .order('dias_de');

    const lst = (faixas || []) as any[];
    if (lst.length) {
      const hit = lst.find((f) => dias >= (Number(f.dias_de) || 0) && (f.dias_ate == null || dias <= Number(f.dias_ate)));
      descAvista = hit ? Math.max(0, Math.min(100, Number(hit.desc_avista) || 0)) : 0;
      descParc = hit ? Math.max(0, Math.min(100, Number(hit.desc_parcelado) || 0)) : 0;
    } else {
      descAvista = descontoPadrao(dias, 'avista');
      descParc = descontoPadrao(dias, 'parcelado');
    }
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


// ===================== Data do pagamento =====================

export type ClasseData = 'hoje' | 'dentro_do_mes' | 'fora_do_mes' | 'indefinido';

export interface DataPagamento {
  classe: ClasseData;
  dataIso: string | null;
  label: string;
}

const MESES = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

const DIAS_SEMANA = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];

/** Palavras que identificam cada dia da semana (0 = domingo). */
const DIAS_SEMANA_RE: Array<[number, RegExp]> = [
  [0, /\b(domingo|dom)\b/],
  [1, /\b(segunda(?:\s*-?\s*feira)?|seg)\b/],
  [2, /\b(terca(?:\s*-?\s*feira)?|ter)\b/],
  [3, /\b(quarta(?:\s*-?\s*feira)?|qua)\b/],
  [4, /\b(quinta(?:\s*-?\s*feira)?|qui)\b/],
  [5, /\b(sexta(?:\s*-?\s*feira)?|sex)\b/],
  [6, /\b(sabado|sab)\b/],
];

/** Detecta menção a um dia da semana no texto já normalizado. */
function detectarDiaSemana(t: string): { idx: number; proxima: boolean } | null {
  // Evita confundir com ordinais ("segunda parcela", "terceira vez")
  if (/\b(segunda|terca|quarta|quinta|sexta)\s+(parcela|vez|opcao|semana)\b/.test(t)) return null;
  for (const [idx, re] of DIAS_SEMANA_RE) {
    if (re.test(t)) {
      const proxima = /(que vem|proxim|seguinte)/.test(t);
      return { idx, proxima };
    }
  }
  return null;
}


const fmtData = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Texto com a data de hoje (fuso São Paulo) e os próximos 7 dias, para que a IA
 * nunca precise calcular datas por conta própria.
 */
export function contextoDataHoje(): string {
  const hoje = agoraSP();
  hoje.setHours(0, 0, 0, 0);
  const linhas: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(hoje);
    d.setDate(d.getDate() + i);
    linhas.push(`${DIAS_SEMANA[d.getDay()]} = ${isoLocal(d)} (${fmtData(d)})`);
  }
  return [
    `HOJE é ${DIAS_SEMANA[hoje.getDay()]}, ${fmtData(hoje)}/${hoje.getFullYear()} (${isoLocal(hoje)}).`,
    `Próximos dias: ${linhas.join('; ')}.`,
    'Use SEMPRE essas datas para interpretar "segunda", "sexta", "amanhã", "semana que vem". Nunca invente outra data.',
  ].join('\n');
}


/**
 * Interpreta a data que o cliente informou ("hoje", "dia 20", "20/08",
 * "semana que vem", "mês que vem") em relação ao horário de São Paulo e
 * classifica em hoje / dentro do mês atual / fora do mês atual.
 */
export function classificarDataPagamento(texto: string): DataPagamento {
  const t = norm(texto).replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  const indef: DataPagamento = { classe: 'indefinido', dataIso: null, label: '' };
  if (!t) return indef;

  const hoje = agoraSP();
  hoje.setHours(0, 0, 0, 0);

  // Data já resolvida pela IA no formato ISO (2026-08-17)
  const iso = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!Number.isNaN(d.getTime())) {
      d.setHours(0, 0, 0, 0);
      const mesmoDia = d.getTime() === hoje.getTime();
      const mesmoMes = d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth();
      return {
        classe: mesmoDia ? 'hoje' : mesmoMes ? 'dentro_do_mes' : 'fora_do_mes',
        dataIso: isoLocal(d),
        label: mesmoDia ? 'hoje' : `${DIAS_SEMANA[d.getDay()]}, dia ${fmtData(d)}`,
      };
    }
  }


  const classificar = (d: Date): DataPagamento => {
    d.setHours(0, 0, 0, 0);
    const mesmoDia = d.getTime() === hoje.getTime();
    const mesmoMes = d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth();
    return {
      classe: mesmoDia ? 'hoje' : mesmoMes ? 'dentro_do_mes' : 'fora_do_mes',
      dataIso: isoLocal(d),
      label: mesmoDia ? 'hoje' : `${DIAS_SEMANA[d.getDay()]}, dia ${fmtData(d)}`,
    };
  };

  if (/(mes que vem|proximo mes|mes seguinte|outro mes|mes vem|virada do mes|inicio do mes que vem)/.test(t)) {
    return { classe: 'fora_do_mes', dataIso: null, label: 'mês que vem' };
  }
  if (/\bhoje\b|\bagora\b|\bja\b(?! nao)/.test(t)) return classificar(new Date(hoje));
  if (/\bamanha\b/.test(t)) {
    const d = new Date(hoje); d.setDate(d.getDate() + 1); return classificar(d);
  }
  if (/(depois de amanha)/.test(t)) {
    const d = new Date(hoje); d.setDate(d.getDate() + 2); return classificar(d);
  }

  // Dia da semana: "segunda", "segunda-feira", "seg", "sexta que vem", "sábado"
  const diaSemana = detectarDiaSemana(t);
  if (diaSemana !== null) {
    const { idx, proxima } = diaSemana;
    const d = new Date(hoje);
    let delta = (idx - hoje.getDay() + 7) % 7;
    if (delta === 0) delta = 7; // "segunda" dito na segunda = próxima segunda
    if (proxima && delta < 7 && idx <= hoje.getDay()) delta += 7;
    d.setDate(d.getDate() + delta);
    return classificar(d);
  }

  if (/(semana que vem|proxima semana)/.test(t)) {
    const d = new Date(hoje); d.setDate(d.getDate() + 7); return classificar(d);
  }


  // 20/08, 20/08/2026, 20-08
  const md = t.match(/\b(\d{1,2})\s*[\/\-.]\s*(\d{1,2})(?:\s*[\/\-.]\s*(\d{2,4}))?\b/);
  if (md) {
    const dia = Number(md[1]); const mes = Number(md[2]) - 1;
    let ano = md[3] ? Number(md[3]) : hoje.getFullYear();
    if (ano < 100) ano += 2000;
    if (dia >= 1 && dia <= 31 && mes >= 0 && mes <= 11) return classificar(new Date(ano, mes, dia));
  }

  // 20 de agosto / agosto dia 20
  const mesNome = MESES.findIndex((m) => new RegExp(`\\b${m}\\b`).test(t));
  if (mesNome >= 0) {
    const dm = t.match(/\b(\d{1,2})\b/);
    const dia = dm ? Number(dm[1]) : 1;
    const ano = mesNome < hoje.getMonth() ? hoje.getFullYear() + 1 : hoje.getFullYear();
    if (dia >= 1 && dia <= 31) return classificar(new Date(ano, mesNome, dia));
  }

  // "dia 20", "no 20", "20"
  const dd = t.match(/\bdia\s*(\d{1,2})\b/) || t.match(/^(\d{1,2})$/) || t.match(/\bno\s*(\d{1,2})\b/);
  if (dd) {
    const dia = Number(dd[1]);
    if (dia >= 1 && dia <= 31) {
      const noMes = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
      if (noMes.getMonth() === hoje.getMonth() && noMes.getTime() >= hoje.getTime()) return classificar(noMes);
      const prox = new Date(hoje.getFullYear(), hoje.getMonth() + 1, dia);
      return classificar(prox);
    }
  }

  return indef;
}

/** Detecta que o cliente escolheu uma forma de pagamento (à vista ou Nx). */
export function detectarEscolha(texto: string): string {
  const t = norm(texto).replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (/(a vista|avista|pagar tudo|valor total de uma vez|de uma vez)/.test(t)) return 'à vista';
  const m = t.match(/\b(\d{1,2})\s*(x|vezes|parcelas?|parcelado em)\b/) || t.match(/\b(\d{1,2})\s*parcelas? de\b/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 2 && n <= 24) return `${n}x`;
  }
  if (/(quero|prefiro|fico com|pode ser) o? ?parcelad/.test(t)) return 'parcelado';
  return '';
}

/** Resposta do cliente à pergunta "consegue pagar hoje?". */
export function respostaPagamentoHoje(texto: string): 'sim' | 'nao' | 'indefinido' {
  const t = norm(texto).replace(/\s+/g, ' ').trim();
  if (!t) return 'indefinido';
  if (/\b(nao|nao da|nao consigo|nao tenho|impossivel|so depois|somente depois|infelizmente nao)\b/.test(t)) return 'nao';
  if (/\b(sim|consigo|hoje|claro|pode ser|vou pagar|posso|ok|beleza|isso)\b/.test(t)) return 'sim';
  return 'indefinido';
}
