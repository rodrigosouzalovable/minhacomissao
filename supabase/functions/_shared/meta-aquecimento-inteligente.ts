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

export interface LeadAquecimento {
  id: string;
  nome: string | null;
  telefone: string;
  nicho: string | null;
  cidade: string | null;
}

function cidadeDoEndereco(endereco?: string | null): string {
  const partes = String(endereco || "").split(",").map((p) => p.trim()).filter(Boolean);
  if (partes.length < 2) return "";
  return (partes[partes.length - 2] || "").replace(/\s*-\s*[A-Z]{2}$/i, "").trim();
}

/** Leads com WhatsApp confirmado, nunca usados no aquecimento, ordenados pelo score do nicho. */
export async function leadsParaAquecimento(
  supabase: any,
  limite = 40,
): Promise<LeadAquecimento[]> {
  const { data: scores } = await supabase
    .from("aquecimento_nicho_score")
    .select("nicho, cidade, score, bloqueado");

  const bloqueados = new Set<string>();
  const scoreMap = new Map<string, number>();
  for (const s of (scores || []) as any[]) {
    const chave = String(s.nicho || "").toLowerCase();
    if (s.bloqueado) bloqueados.add(chave);
    const anterior = scoreMap.get(chave) ?? -1;
    if (Number(s.score) > anterior) scoreMap.set(chave, Number(s.score));
  }

  const { data: leads } = await supabase
    .from("google_maps_leads")
    .select("id, nome, telefone, telefone_internacional, categoria, endereco")
    .eq("tem_whatsapp", true)
    .is("usado_aquecimento_em", null)
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

  return candidatos
    .filter((l: LeadAquecimento) => !suprimidos.has(l.telefone.slice(-8)))
    .sort((a: LeadAquecimento, b: LeadAquecimento) =>
      (scoreMap.get(String(b.nicho || "").toLowerCase()) ?? 0) -
      (scoreMap.get(String(a.nicho || "").toLowerCase()) ?? 0)
    )
    .slice(0, limite);
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
