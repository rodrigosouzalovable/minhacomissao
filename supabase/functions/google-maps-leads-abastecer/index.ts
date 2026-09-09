// Reabastece a lista de contatos do Google Maps usada no resgate de engajamento.
// Roda de carona no tick do aquecimento (sem cron novo) e no máximo 1x por dia:
//  - só entra em ação quando o estoque de contatos com WhatsApp confirmado está baixo
//  - escolhe os nichos/cidades com melhor histórico de resposta (aquecimento_nicho_score)
//  - busca no Google Maps, confirma quem tem WhatsApp e guarda sem duplicar telefone
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hojeBrt } from "../_shared/meta-aquecimento-alvo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ESTOQUE_MINIMO = 80;
const MAX_BUSCAS_POR_DIA = 1;
const MAX_RESULTADOS = 60;

const SEMENTES = [
  { nicho: "clínica odontológica", cidade: "Goiânia GO" },
  { nicho: "psicólogo", cidade: "Goiânia GO" },
  { nicho: "clínica veterinária", cidade: "Goiânia GO" },
];

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const dia = String(body?.dia || hojeBrt());
    const forcar = body?.forcar === true;

    // ===== Estoque atual =====
    const carencia = new Date(Date.now() - 15 * 86400000).toISOString();
    const { count: estoque } = await supabase
      .from("google_maps_leads")
      .select("id", { count: "exact", head: true })
      .eq("tem_whatsapp", true)
      .or(`usado_aquecimento_em.is.null,usado_aquecimento_em.lt.${carencia}`);

    if (!forcar && (estoque ?? 0) >= ESTOQUE_MINIMO) {
      return json({ ok: true, skipped: "estoque_suficiente", estoque: estoque ?? 0 });
    }

    // ===== Trava de 1 busca por dia (evita custo do Google Maps se repetindo) =====
    const inicioDia = new Date(`${dia}T00:00:00-03:00`).toISOString();
    const { count: buscasHoje } = await supabase
      .from("google_maps_buscas")
      .select("id", { count: "exact", head: true })
      .gte("created_at", inicioDia);
    if (!forcar && (buscasHoje ?? 0) >= MAX_BUSCAS_POR_DIA) {
      return json({ ok: true, skipped: "limite_diario_de_busca", buscas_hoje: buscasHoje ?? 0 });
    }

    // ===== Melhor nicho/cidade conhecido =====
    const { data: scores } = await supabase
      .from("aquecimento_nicho_score")
      .select("nicho, cidade, score, envios, bloqueado")
      .eq("bloqueado", false)
      .order("score", { ascending: false })
      .limit(10);

    const bons = ((scores as any[]) || []).filter((s) => Number(s.envios || 0) >= 3);
    const alvo = bons.length > 0
      ? { nicho: String(bons[0].nicho), cidade: String(bons[0].cidade || "Goiânia GO") }
      : SEMENTES[Math.floor(Math.random() * SEMENTES.length)];

    // ===== Busca no Google Maps =====
    const { data: busca, error: erroBusca } = await supabase.functions.invoke(
      "google-maps-buscar-leads",
      {
        body: {
          categoria: alvo.nicho,
          localizacao: alvo.cidade,
          max_resultados: MAX_RESULTADOS,
          somente_novos: true,
          origem: "resgate_engajamento",
        },
      },
    );
    if (erroBusca) {
      return json({ ok: false, alvo, error: String(erroBusca.message || erroBusca) }, 200);
    }

    // Verifica quem tem WhatsApp nos números recém-captados (usa as instâncias UAZAPI conectadas)
    const buscaId = (busca as any)?.busca_id || null;
    let verificacao: unknown = null;
    if (buscaId) {
      const { data: vData, error: vErr } = await supabase.functions.invoke(
        "google-maps-verificar-whatsapp",
        { body: { busca_id: buscaId } },
      );
      verificacao = vErr ? { erro: String(vErr.message || vErr) } : vData;
    }




    const { count: estoqueFinal } = await supabase
      .from("google_maps_leads")
      .select("id", { count: "exact", head: true })
      .eq("tem_whatsapp", true)
      .or(`usado_aquecimento_em.is.null,usado_aquecimento_em.lt.${carencia}`);

    return json({
      ok: true,
      alvo,
      estoque_antes: estoque ?? 0,
      estoque_depois: estoqueFinal ?? 0,
      busca_id: buscaId,
      nicho_usado: alvo.nicho,
      verificacao_whatsapp: verificacao,
    });
  } catch (e) {
    console.error("[google-maps-leads-abastecer]", e);
    return json({ ok: false, error: e instanceof Error ? e.message : "erro" }, 500);
  }
});
