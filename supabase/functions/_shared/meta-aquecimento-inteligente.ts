// Helpers do aquecimento inteligente dos números Meta.
// Combina destinos UAZAPI (respondidos pelo IAGO) com leads reais do Google
// Maps de nichos que respondem bem, sempre respeitando o orçamento diário.

import { hojeBrt } from "./meta-aquecimento-alvo.ts";

export interface Orcamento {
  dia: string;
  teto_reais: number;
  gasto_reais: number;
  custo_utility: number;
  custo_marketing: number;
}

export async function carregarOrcamento(supabase: any, dia = hojeBrt()): Promise<Orcamento> {
  const { data } = await supabase
    .from("meta_aquecimento_orcamento")
    .select("*")
    .eq("dia", dia)
    .maybeSingle();
  if (data) return data as Orcamento;

  // Herda o teto configurado no último dia registrado (ou o padrão de R$ 50).
  const { data: ultimo } = await supabase
    .from("meta_aquecimento_orcamento")
    .select("teto_reais, custo_utility, custo_marketing")
    .order("dia", { ascending: false })
    .limit(1)
    .maybeSingle();

  const novo = {
    dia,
    teto_reais: Number(ultimo?.teto_reais ?? 50),
    gasto_reais: 0,
    custo_utility: Number(ultimo?.custo_utility ?? 0.04),
    custo_marketing: Number(ultimo?.custo_marketing ?? 0.20),
  };
  await supabase.from("meta_aquecimento_orcamento").upsert(novo, { onConflict: "dia" });
  return novo as Orcamento;
}

export function custoDoTemplate(orc: Orcamento, categoria?: string | null): number {
  return String(categoria || "UTILITY").toUpperCase() === "MARKETING"
    ? Number(orc.custo_marketing)
    : Number(orc.custo_utility);
}

export async function registrarGasto(supabase: any, dia: string, valor: number) {
  if (!valor) return;
  const { data } = await supabase
    .from("meta_aquecimento_orcamento")
    .select("gasto_reais")
    .eq("dia", dia)
    .maybeSingle();
  const atual = Number(data?.gasto_reais ?? 0);
  await supabase
    .from("meta_aquecimento_orcamento")
    .update({ gasto_reais: atual + valor, atualizado_em: new Date().toISOString() })
    .eq("dia", dia);
}

/** A partir de quantos envios sem nenhuma resposta o nicho sai da fila. */
export const SEM_RESPOSTA_MIN_ENVIOS = 12;

export interface LeadAquecimento {
  id: string;
  nome: string | null;
  telefone: string;
  nicho: string | null;
  cidade: string | null;
  respondedor?: boolean;
  nunca_usado?: boolean;
}


function cidadeDoEndereco(endereco?: string | null): string {
  const partes = String(endereco || "").split(",").map((p) => p.trim()).filter(Boolean);
  if (partes.length < 2) return "";
  return (partes[partes.length - 2] || "").replace(/\s*-\s*[A-Z]{2}$/i, "").trim();
}

/**
 * Leads com WhatsApp confirmado, ordenados pelo score do nicho.
 * Entram os nunca usados e também os já usados há mais de 15 dias (carência),
 * com prioridade para quem já respondeu alguma vez.
 */
export async function leadsParaAquecimento(
  supabase: any,
  limite = 40,
): Promise<LeadAquecimento[]> {
  const { data: scores } = await supabase
    .from("aquecimento_nicho_score")
    .select("nicho, cidade, score, bloqueado, envios, respostas");

  const bloqueados = new Set<string>();
  const scoreMap = new Map<string, number>();
  const enviosNicho = new Map<string, number>();
  const respostasNicho = new Map<string, number>();
  for (const s of (scores || []) as any[]) {
    const chave = String(s.nicho || "").toLowerCase();
    if (s.bloqueado) bloqueados.add(chave);
    const anterior = scoreMap.get(chave) ?? -1;
    if (Number(s.score) > anterior) scoreMap.set(chave, Number(s.score));
    enviosNicho.set(chave, (enviosNicho.get(chave) || 0) + Number(s.envios || 0));
    respostasNicho.set(chave, (respostasNicho.get(chave) || 0) + Number(s.respostas || 0));
  }

  // Nicho que já recebeu volume relevante e nunca respondeu sai da fila.
  for (const [chave, envios] of enviosNicho.entries()) {
    if (envios >= SEM_RESPOSTA_MIN_ENVIOS && (respostasNicho.get(chave) || 0) === 0) {
      bloqueados.add(chave);
    }
  }

  const carencia = new Date(Date.now() - 15 * 86400000).toISOString();
  const { data: leads } = await supabase
    .from("google_maps_leads")
    .select("id, nome, telefone, telefone_internacional, categoria, endereco, usado_aquecimento_em, resultado_aquecimento")
    .eq("tem_whatsapp", true)
    .or(`usado_aquecimento_em.is.null,usado_aquecimento_em.lt.${carencia}`)
    .limit(600);


  const candidatos = (leads || [])
    .map((l: any) => {
      const tel = String(l.telefone_internacional || l.telefone || "").replace(/\D/g, "");
      return {
        id: l.id as string,
        nome: l.nome as string | null,
        telefone: tel.startsWith("55") ? tel : `55${tel}`,
        nicho: (l.categoria as string | null) || null,
        cidade: cidadeDoEndereco(l.endereco),
        respondedor: String(l.resultado_aquecimento || "").toLowerCase().includes("respondeu"),
        nunca_usado: !l.usado_aquecimento_em,
      } as LeadAquecimento;
    })
    .filter((l: LeadAquecimento) => l.telefone.length >= 12 && l.telefone.length <= 13)
    .filter((l: LeadAquecimento) => !bloqueados.has(String(l.nicho || "").toLowerCase()));

  if (candidatos.length === 0) return [];

  // Remove números na blacklist/supressão (comparação por sufixo de 8 dígitos).
  const sufixos = candidatos.map((l: LeadAquecimento) => l.telefone.slice(-8));
  const { data: sup } = await supabase
    .from("meta_destinatario_supressao")
    .select("telefone_sufixo")
    .in("telefone_sufixo", sufixos.slice(0, 500));
  const suprimidos = new Set((sup || []).map((s: any) => String(s.telefone_sufixo)));

  const peso = (l: LeadAquecimento) =>
    (scoreMap.get(String(l.nicho || "").toLowerCase()) ?? 0) +
    (l.respondedor ? 100 : 0) +
    (l.nunca_usado ? 10 : 0);

  return candidatos
    .filter((l: LeadAquecimento) => !suprimidos.has(l.telefone.slice(-8)))
    .sort((a: LeadAquecimento, b: LeadAquecimento) => peso(b) - peso(a))
    .slice(0, limite);

}

/** Caixa de mensagens AQUECIMENTO (Inbox Meta). */
export const FOLDER_AQUECIMENTO_ID = "4f7a52c0-9c86-4b80-8867-4ade7a6df441";
/** Marca que identifica conversas de leads do Google Maps usados no aquecimento. */
export const ORIGEM_LEAD_AQUECIMENTO = "lead_google_maps";

/**
 * Registra a conversa do lead do Google Maps na caixa AQUECIMENTO, para que o
 * envio apareça no Inbox e possa ser acompanhado separadamente.
 * Essas conversas ficam fora do atendimento automático (IAGO) e do rodízio.
 */
export async function registrarConversaLead(
  supabase: any,
  inst: { id: string; user_id?: string | null },
  telefone: string,
  nome: string | null,
  templateNome: string,
  wamid?: string | null,
  textoReal?: string | null,
) {
  try {
    const agora = new Date().toISOString();
    const preview = String(textoReal || "").trim() || `[Aquecimento] template ${templateNome}`;

    const { data: existente } = await supabase
      .from("meta_whatsapp_contatos")
      .select("id")
      .eq("instancia_id", inst.id)
      .eq("telefone", telefone)
      .maybeSingle();

    let contatoId: string | null = (existente as any)?.id ?? null;
    if (contatoId) {
      await supabase.from("meta_whatsapp_contatos").update({
        ultima_mensagem: preview,
        ultima_mensagem_em: agora,
        atualizado_em: agora,
        arquivado: false,
        folder_id: FOLDER_AQUECIMENTO_ID,
        origem_aquecimento: ORIGEM_LEAD_AQUECIMENTO,
        ...(nome ? { nome } : {}),
      }).eq("id", contatoId);
    } else {
      const { data: novo } = await supabase.from("meta_whatsapp_contatos").insert({
        user_id: inst.user_id,
        instancia_id: inst.id,
        telefone,
        telefone_visivel: true,
        nome: nome || null,
        ultima_mensagem: preview,
        ultima_mensagem_em: agora,
        folder_id: FOLDER_AQUECIMENTO_ID,
        origem_aquecimento: ORIGEM_LEAD_AQUECIMENTO,
      }).select("id").maybeSingle();
      contatoId = (novo as any)?.id ?? null;
    }

    await supabase.from("meta_whatsapp_mensagens").insert({
      user_id: inst.user_id,
      instancia_id: inst.id,
      telefone,
      direcao: "saida",
      conteudo: preview,
      tipo_conteudo: "texto",
      timestamp_msg: agora,
      status_envio: "enviada",
      wa_message_id: wamid || null,
      template_nome: templateNome,
    });

    return contatoId;
  } catch (e) {
    console.log("[aquecimento] falha ao registrar conversa do lead:", String(e).slice(0, 200));
    return null;
  }
}

export async function marcarLeadUsado(
  supabase: any,
  leadId: string,
  resultado: string,
) {
  await supabase
    .from("google_maps_leads")
    .update({ usado_aquecimento_em: new Date().toISOString(), resultado_aquecimento: resultado })
    .eq("id", leadId);
}

/** Tier corrente do número, na melhor informação disponível. */
export function tierAtual(inst: any): number {
  const bruto = String(inst?.saude_tier || "").toUpperCase();
  const m = bruto.match(/(\d+)/);
  if (m) return Number(m[1]);
  return Number(inst?.tier_diario ?? 250);
}

export function proximoTier(atual: number): number {
  if (atual < 1000) return 1000;
  if (atual < 10000) return 10000;
  if (atual < 100000) return 100000;
  return atual;
}

/** Devolve o lead para a fila quando a tentativa falhou (não gastou conversa). */
export async function devolverLead(supabase: any, leadId: string) {
  await supabase
    .from("google_maps_leads")
    .update({ usado_aquecimento_em: null, resultado_aquecimento: null })
    .eq("id", leadId);
}

/**
 * BM bloqueada pela Meta (#131031): tira do aquecimento todos os números dela.
 * Retorna quantos números foram pausados e o nome da BM.
 */
export async function pausarInstanciasDaBm(
  supabase: any,
  inst: any,
  motivo: string,
  horas = 12,
): Promise<{ bm: string; pausadas: number }> {
  const ate = new Date(Date.now() + horas * 3600000).toISOString();
  let bmNome = "não vinculada";
  let ids: string[] = [inst.id];

  const bmId = inst?.meta_bm_id || null;
  if (bmId) {
    const { data: bm } = await supabase
      .from("meta_business_managers").select("nome").eq("id", bmId).maybeSingle();
    bmNome = String(bm?.nome || bmId);
    const { data: irmas } = await supabase
      .from("meta_whatsapp_instances").select("id").eq("meta_bm_id", bmId).eq("ativo", true);
    ids = Array.from(new Set([...(irmas || []).map((r: any) => r.id as string), inst.id]));
  }

  await supabase
    .from("meta_whatsapp_instances")
    .update({ pausa_automatica_ate: ate, pausa_automatica_motivo: motivo })
    .in("id", ids);

  return { bm: bmNome, pausadas: ids.length };
}

/**
 * Recalcula o placar de nichos a partir do log real (usado no ciclo intradiário
 * e no aprendizado noturno). Retorna as linhas gravadas.
 */
export async function recalcularScoreNichos(supabase: any, dias = 30): Promise<any[]> {
  const desde = new Date(Date.now() - dias * 86400000).toISOString();
  const { data: logs } = await supabase
    .from("meta_aquecimento_destino_log")
    .select("nicho, cidade, status, respondeu_em, segundos_para_resposta, erro")
    .eq("fonte", "lead")
    .gte("enviado_em", desde)
    .limit(20000);

  type Agg = { envios: number; respostas: number; rapidas: number; reclamacoes: number };
  const agg = new Map<string, Agg>();
  for (const l of (logs || []) as any[]) {
    const nicho = String(l.nicho || "").trim();
    if (!nicho) continue;
    const cidade = String(l.cidade || "").trim();
    const k = `${nicho.toLowerCase()}||${cidade.toLowerCase()}`;
    const a = agg.get(k) || { envios: 0, respostas: 0, rapidas: 0, reclamacoes: 0 };
    if (l.status !== "falha") a.envios++;
    if (l.respondeu_em) a.respostas++;
    if (Number(l.segundos_para_resposta ?? 99999) <= 120) a.rapidas++;
    const erro = String(l.erro || "").toLowerCase();
    if (erro.includes("block") || erro.includes("spam") || erro.includes("131026")) a.reclamacoes++;
    agg.set(k, a);
  }

  const linhas: any[] = [];
  for (const [k, a] of agg.entries()) {
    const [nicho, cidade] = k.split("||");
    const taxaResp = a.envios > 0 ? a.respostas / a.envios : 0;
    const taxaRapida = a.envios > 0 ? a.rapidas / a.envios : 0;
    const taxaRecl = a.envios > 0 ? a.reclamacoes / a.envios : 0;
    linhas.push({
      nicho,
      cidade,
      envios: a.envios,
      respostas: a.respostas,
      respostas_rapidas: a.rapidas,
      reclamacoes: a.reclamacoes,
      score: Math.max(0, Math.round((taxaResp * 60 + taxaRapida * 40 - taxaRecl * 200) * 100) / 100),
      bloqueado: a.reclamacoes > 0 && taxaRecl >= 0.02,
      atualizado_em: new Date().toISOString(),
    });
  }

  if (linhas.length > 0) {
    await supabase.from("aquecimento_nicho_score").upsert(linhas, { onConflict: "nicho,cidade" });
  }
  return linhas;
}

/**
 * Taxa de resposta dos leads na última janela (minutos). Serve de gatilho para
 * corrigir a rota: quando ninguém responde, o motor volta para os destinos
 * próprios da UAZAPI e para os nichos com melhor histórico.
 */
export async function taxaRespostaRecenteLeads(
  supabase: any,
  minutos = 30,
): Promise<{ envios: number; respostas: number; taxa: number }> {
  const desde = new Date(Date.now() - minutos * 60000).toISOString();
  const { data } = await supabase
    .from("meta_aquecimento_destino_log")
    .select("respondeu_em, status")
    .eq("fonte", "lead")
    .neq("status", "falha")
    .gte("enviado_em", desde)
    .limit(2000);
  const envios = (data || []).length;
  const respostas = (data || []).filter((l: any) => l.respondeu_em).length;
  return { envios, respostas, taxa: envios > 0 ? respostas / envios : 1 };
}
