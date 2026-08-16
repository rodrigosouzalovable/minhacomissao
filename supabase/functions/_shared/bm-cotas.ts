// Cota de disparos por Business Manager (BM) — janela móvel de 24h.
// Conta apenas envios por template (meta_whatsapp_envios_log), que é exatamente
// o que abre conversa: campanhas + "Nova conversa" do Inbox.
// Respostas dentro da janela de 24h já aberta NÃO entram nessa contagem.

export interface CotaBm {
  bm_id: string;
  nome: string;
  tier_diario: number;
  tier_ilimitado: boolean;
  enviados_24h: number;
  restantes: number;
  instancias: number;
}

export async function carregarCotasBm(supabase: any): Promise<Map<string, CotaBm>> {
  const map = new Map<string, CotaBm>();
  try {
    const { data, error } = await supabase.rpc('meta_bm_uso_24h');
    if (error) {
      console.log('[bm-cotas] erro RPC:', error.message);
      return map;
    }
    for (const r of (data || []) as any[]) {
      map.set(r.bm_id, {
        bm_id: r.bm_id,
        nome: r.nome,
        tier_diario: Number(r.tier_diario ?? 0),
        tier_ilimitado: r.tier_ilimitado === true,
        enviados_24h: Number(r.enviados_24h ?? 0),
        restantes: Number(r.restantes ?? 0),
        instancias: Number(r.instancias ?? 0),
      });
    }
  } catch (e) {
    console.log('[bm-cotas] falha:', String(e).slice(0, 200));
  }
  return map;
}

/** Retorna o motivo do bloqueio, ou null quando há saldo (ou BM não vinculada). */
export function motivoBloqueioBm(
  cotas: Map<string, CotaBm>,
  metaBmId: string | null | undefined,
): string | null {
  if (!metaBmId) return null; // sem BM vinculada: não há cota a aplicar
  const c = cotas.get(metaBmId);
  if (!c || c.tier_ilimitado) return null;
  if (c.enviados_24h >= c.tier_diario) {
    return `cota da BM "${c.nome}" esgotada (${c.enviados_24h}/${c.tier_diario} nas últimas 24h)`;
  }
  return null;
}
