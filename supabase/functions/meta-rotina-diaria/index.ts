// Rotina diária (06h BRT): sincroniza templates (+ injeção dos faltantes),
// revalida saúde/qualidade/banimento de todas as instâncias Meta e confere webhooks.
// Autorizada somente pelo token do próprio agendamento 'meta-rotina-diaria-06h'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (p: unknown, status = 200) =>
  new Response(JSON.stringify(p), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, key);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const { data: ok, error } = await db.rpc("meta_rotina_diaria_autorizada", { p_token: token });
  if (error || ok !== true) return json({ success: false, error: "Acesso interno obrigatório" }, 403);

  const call = (fn: string, body: unknown, ms = 140_000) =>
    fetch(`${url}/functions/v1/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ms),
    }).then(async (r) => ({ fn, status: r.status, body: (await r.text()).slice(0, 300) }))
      .catch((e) => ({ fn, status: 0, body: String(e).slice(0, 200) }));

  // Instâncias banidas/restritas e com leitura mais antiga primeiro.
  const { data: insts } = await db.from("meta_whatsapp_instances")
    .select("id, saude_status, saude_checked_at")
    .eq("ativo", true).eq("provider", "meta").not("phone_number_id", "is", null)
    .order("saude_checked_at", { ascending: true, nullsFirst: true }).limit(600);
  const ids = (insts || []).map((i: any) => i.id as string);
  const lotes: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) lotes.push(ids.slice(i, i + 100));

  const trabalho = (async () => {
    const saude = await Promise.all(lotes.map((l) => call("check-meta-instance-health", { instancia_ids: l })));
    // Depois da saúde (números desbanidos já liberados), templates + injeção e webhooks.
    const [tpl, wh] = await Promise.all([
      call("meta-templates-sync-diario", { auto: true, dry_run: false, force: true }),
      call("meta-webhook-health", { scheduled: true }),
    ]);
    console.log("[rotina-diaria]", JSON.stringify({ saude, tpl, wh }));
  })();
  // @ts-ignore EdgeRuntime existe no runtime
  EdgeRuntime.waitUntil(trabalho);
  return json({ success: true, iniciado: true, instancias: ids.length, lotes: lotes.length });
});
