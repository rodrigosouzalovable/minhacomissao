type ServiceClient = any;

export interface GoogleMapsKeyRow {
  id: string;
  email_conta: string | null;
  api_key: string;
  ordem_prioridade: number;
  ativa: boolean;
  limite_maximo: number;
  limite_bloqueio: number;
  indisponivel_mes: string | null;
  updated_at: string;
  total_consultas: number;
}

export function mesAtualBrt() {
  const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function listarChavesGoogleMaps(supabase: ServiceClient): Promise<GoogleMapsKeyRow[]> {
  const mes = mesAtualBrt();
  const { data: chaves, error: chavesError } = await supabase
    .from("google_maps_api_keys")
    .select("id, email_conta, api_key, ordem_prioridade, ativa, limite_maximo, limite_bloqueio, indisponivel_mes, updated_at")
    .order("ordem_prioridade", { ascending: true });
  if (chavesError) throw chavesError;

  const { data: usos, error: usosError } = await supabase
    .from("google_maps_uso_chave")
    .select("chave_id, total_consultas")
    .eq("mes_referencia", mes);
  if (usosError) throw usosError;

  const usoPorChave = new Map<string, number>(
    ((usos ?? []) as Array<{ chave_id: string; total_consultas: number }>).map((uso) => [uso.chave_id, Number(uso.total_consultas || 0)]),
  );

  return ((chaves ?? []) as Array<Omit<GoogleMapsKeyRow, "total_consultas">>).map((chave) => ({
    ...chave,
    api_key: String(chave.api_key ?? "").trim(),
    total_consultas: usoPorChave.get(chave.id) ?? 0,
  }));
}

export function chavePodeBuscar(chave: GoogleMapsKeyRow) {
  return chave.ativa &&
    chave.api_key.length > 0 &&
    chave.total_consultas < chave.limite_bloqueio &&
    chave.indisponivel_mes !== mesAtualBrt();
}

export async function marcarChaveIndisponivelNoMes(supabase: ServiceClient, chaveId: string) {
  const { error } = await supabase
    .from("google_maps_api_keys")
    .update({ indisponivel_mes: mesAtualBrt(), updated_at: new Date().toISOString() })
    .eq("id", chaveId);
  if (error) throw error;
}

export function mascararEmail(email: string | null) {
  if (!email || !email.includes("@")) return "e-mail não informado";
  const [nome, dominio] = email.split("@");
  const inicio = nome.slice(0, Math.min(2, nome.length));
  return `${inicio}${"*".repeat(Math.max(2, nome.length - inicio.length))}@${dominio}`;
}