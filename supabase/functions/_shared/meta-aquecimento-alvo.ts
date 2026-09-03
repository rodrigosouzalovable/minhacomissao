// Helpers do aquecimento Meta → UAZAPI.
// Os números UAZAPI espelhados na pasta AQUECIMENTO são atendidos pelo IAGO,
// então toda mensagem enviada para eles gera entrada (inbound) real.

const GRAPH = "https://graph.facebook.com/v21.0";

export const FOLDERS_AQUECIMENTO_FALLBACK = [
  "4f7a52c0-9c86-4b80-8867-4ade7a6df441", // AQUECIMENTO
];

export interface DestinoAquecimento {
  id: string;
  nome: string | null;
  telefone: string;
}

/** Números UAZAPI (espelhos) vinculados às pastas de aquecimento. */
export async function destinosAquecimento(supabase: any): Promise<DestinoAquecimento[]> {
  const { data: folders } = await supabase
    .from("meta_inbox_folders")
    .select("id, nome")
    .ilike("nome", "%AQUECIMENTO%");
  const folderIds = (folders || []).map((f: any) => f.id);
  const ids = folderIds.length > 0 ? folderIds : FOLDERS_AQUECIMENTO_FALLBACK;

  const { data } = await supabase
    .from("meta_whatsapp_instances")
    .select("id, nome, display_phone, provider, ativo, folder_padrao_id")
    .eq("provider", "uazapi")
    .eq("ativo", true)
    .in("folder_padrao_id", ids);

  return (data || [])
    .map((d: any) => ({
      id: d.id,
      nome: d.nome,
      telefone: String(d.display_phone || "").replace(/\D/g, ""),
    }))
    .filter((d: DestinoAquecimento) => d.telefone.length >= 10);
}

export interface TemplateAquecimento {
  name: string;
  language: string;
  categoria?: string;
  params: { tipo: "posicional" | "nomeado"; chaves: string[] };
}

const VALOR_PADRAO = "confirmação de cadastro";

function tokensDoCorpo(components: any[]): string[] {
  const body = (components || []).find((c: any) => String(c?.type).toUpperCase() === "BODY");
  const texto = String(body?.text || "");
  const found = texto.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || [];
  return found.map((t) => t.replace(/[{}\s]/g, ""));
}

function temBotaoDinamico(components: any[]): boolean {
  const btns = (components || []).find((c: any) => String(c?.type).toUpperCase() === "BUTTONS");
  const lista = btns?.buttons || [];
  return lista.some((b: any) => String(b?.url || "").includes("{{"));
}

function temCabecalhoMidia(components: any[]): boolean {
  const h = (components || []).find((c: any) => String(c?.type).toUpperCase() === "HEADER");
  const fmt = String(h?.format || "TEXT").toUpperCase();
  return fmt !== "TEXT";
}

/**
 * Escolhe um template UTILITY aprovado do WABA da instância, preferindo o mais
 * simples (menos variáveis, sem mídia e sem botão dinâmico).
 */
export async function escolherTemplateAprovado(
  inst: any,
  preferido?: string | null,
): Promise<TemplateAquecimento | null> {
  if (!inst?.waba_id || !inst?.access_token) return null;
  const res = await fetch(
    `${GRAPH}/${inst.waba_id}/message_templates?status=APPROVED&limit=100&fields=name,language,status,category,components`,
    { headers: { Authorization: `Bearer ${inst.access_token}` } },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(data?.data)) return null;

  const candidatos = data.data
    .filter((t: any) => !temBotaoDinamico(t.components) && !temCabecalhoMidia(t.components))
    .map((t: any) => {
      const toks = tokensDoCorpo(t.components);
      const nomeados = toks.some((k) => !/^\d+$/.test(k));
      return {
        name: t.name as string,
        language: (t.language as string) || "pt_BR",
        categoria: String(t.category || "").toUpperCase(),
        params: {
          tipo: (nomeados ? "nomeado" : "posicional") as "nomeado" | "posicional",
          chaves: toks,
        },
        peso: toks.length,
      };
    });

  if (candidatos.length === 0) return null;

  const escolhido =
    (preferido && candidatos.find((c: any) => c.name === preferido)) ||
    candidatos
      .filter((c: any) => c.categoria === "UTILITY")
      .sort((a: any, b: any) => a.peso - b.peso)[0] ||
    candidatos.sort((a: any, b: any) => a.peso - b.peso)[0];

  return escolhido
    ? {
        name: escolhido.name,
        language: escolhido.language,
        categoria: escolhido.categoria,
        params: escolhido.params,
      }
    : null;
}

/** Envia o template de aquecimento pela Graph API. */
export async function enviarTemplateAquecimento(
  inst: any,
  telefone: string,
  tpl: TemplateAquecimento,
  nomeDestino?: string | null,
): Promise<{ ok: boolean; wamid?: string; erro?: string; codigo?: number }> {
  const valores = tpl.params.chaves.map((chave, idx) => {
    const primeiro = idx === 0;
    const valor = primeiro ? (nomeDestino || "Parceiro") : VALOR_PADRAO;
    return tpl.params.tipo === "nomeado"
      ? { type: "text", parameter_name: chave, text: valor }
      : { type: "text", text: valor };
  });

  const body: any = {
    messaging_product: "whatsapp",
    to: telefone,
    type: "template",
    template: {
      name: tpl.name,
      language: { code: tpl.language },
      ...(valores.length > 0
        ? { components: [{ type: "body", parameters: valores }] }
        : {}),
    },
  };

  const res = await fetch(`${GRAPH}/${inst.phone_number_id}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${inst.access_token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      erro: data?.error?.message || `HTTP ${res.status}`,
      codigo: Number(data?.error?.code) || undefined,
    };
  }
  return { ok: true, wamid: data?.messages?.[0]?.id };
}

/** Erros da Meta que devem parar o ciclo (bloqueio de conta / pagamento). */
export function erroFatalMeta(codigo?: number, mensagem?: string): boolean {
  if (codigo && [131031, 131042, 100, 190, 133010].includes(codigo)) return true;
  const m = String(mensagem || "").toLowerCase();
  return m.includes("account locked") || m.includes("payment") || m.includes("not registered");
}

export function hojeBrt(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  ).toISOString().slice(0, 10);
}

export function dentroJanelaAquecimento(
  hIni = 9,
  hFim = 19,
): { ok: boolean; motivo?: string } {
  const sp = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  if (sp.getDay() === 0) return { ok: false, motivo: "domingo" };
  const h = sp.getHours() + sp.getMinutes() / 60;
  if (h < hIni || h >= hFim) return { ok: false, motivo: "fora_janela" };
  return { ok: true };
}

export function sorteio(min: number, max: number): number {
  const a = Math.min(min, max);
  const b = Math.max(min, max);
  return Math.floor(a + Math.random() * (b - a + 1));
}
