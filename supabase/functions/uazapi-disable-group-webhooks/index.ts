// Edge function: Reconfigure ALL UAZAPI webhooks to exclude groups, broadcasts, and own-msg echoes.
// Purpose: Stop credit bleed caused by webhook spam from group chats.
// Trigger: Manual via "Pânico" button in Monitor de Envios.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const adminToken = Deno.env.get("UAZAPI_ADMIN_TOKEN") || "";
    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-chatbot`;

    const { data: instances, error } = await supabase
      .from("user_whatsapp_instances")
      .select("id, nome, server_url, instance_token")
      .eq("ativo", true)
      .limit(typeof body?.limit === "number" && body.limit > 0 ? body.limit : 500);

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!instances || instances.length === 0) {
      return new Response(JSON.stringify({ ok: true, total: 0, success: 0, failed: 0, details: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Full webhook config: ENABLED + only direct messages, no groups, no broadcasts.
    // enabled:true is critical — UAZAPI sometimes recreates webhooks disabled by default.
    const restrictedPayload = JSON.stringify({
      url: webhookUrl,
      events: ["messages"],
      enabled: true,
      excludeGroupMessages: true,
      excludeBroadcast: true,
    });

    const postOnce = async (postUrl: string, headers: Record<string, string>) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      try {
        const res = await fetch(postUrl, { method: "POST", headers, body: restrictedPayload, signal: ctrl.signal });
        clearTimeout(t);
        return { ok: res.ok, status: res.status, text: res.ok ? "" : (await res.text()).substring(0, 120) };
      } catch (e) {
        clearTimeout(t);
        return { ok: false, status: 0, text: e instanceof Error ? e.message : String(e) };
      }
    };

    // Verify webhook is actually enabled after POST
    const verifyEnabled = async (base: string, token: string): Promise<{ enabled: boolean | null; found: boolean }> => {
      const getAttempts = [
        { url: `${base}/webhook/${token}`, headers: {} as Record<string, string> },
        { url: `${base}/webhook`, headers: { token } },
      ];
      for (const a of getAttempts) {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 10000);
          const res = await fetch(a.url, { method: "GET", headers: a.headers, signal: ctrl.signal });
          clearTimeout(t);
          if (!res.ok) continue;
          const text = await res.text();
          let data: any = null;
          try { data = JSON.parse(text); } catch { continue; }
          const items = Array.isArray(data) ? data : (data?.webhooks || data?.data || [data]);
          const match = items.find((it: any) => {
            const u = it?.url || it?.webhook || "";
            return u === webhookUrl;
          });
          if (match) return { enabled: match.enabled === true ? true : (match.enabled === false ? false : null), found: true };
        } catch (_) {}
      }
      return { enabled: null, found: false };
    };

    // Process all in parallel
    const tasks = instances.map(async (inst) => {
      const base = inst.server_url.replace(/\/+$/, "");
      const token = inst.instance_token;
      const attempts = [
        { url: `${base}/webhook/${token}`, headers: { "Content-Type": "application/json" } },
        { url: `${base}/webhook`, headers: { "Content-Type": "application/json", token } },
        { url: `${base}/globalwebhook`, headers: { "Content-Type": "application/json", admintoken: adminToken } },
      ];

      let posted = false;
      let lastErr = "";
      for (const a of attempts) {
        const r = await postOnce(a.url, a.headers);
        if (r.ok) { posted = true; break; }
        lastErr = `${r.status}: ${r.text}`;
      }

      if (!posted) {
        console.log(`[RECONFIG] ❌ POST failed ${inst.nome || inst.id}: ${lastErr}`);
        return { id: inst.id, nome: inst.nome || inst.id, ok: false, error: lastErr, enabled_after: null };
      }

      // Verify enabled state; if disabled, retry POST once
      let verify = await verifyEnabled(base, token);
      if (verify.found && verify.enabled === false) {
        console.log(`[RECONFIG] ⚠️ ${inst.nome || inst.id} returned enabled:false — retrying POST`);
        for (const a of attempts) {
          const r = await postOnce(a.url, a.headers);
          if (r.ok) break;
        }
        await new Promise((r) => setTimeout(r, 1500));
        verify = await verifyEnabled(base, token);
      }

      const healthy = verify.enabled === true;
      console.log(`[RECONFIG] ${healthy ? "✅" : "⚠️"} ${inst.nome || inst.id} (enabled=${verify.enabled})`);
      return { id: inst.id, nome: inst.nome || inst.id, ok: true, enabled_after: verify.enabled, healthy };
    });

    const details = await Promise.all(tasks);
    const success = details.filter(d => d.ok).length;
    const failed = details.length - success;
    const healthy_after = details.filter((d: any) => d.healthy === true).length;

    return new Response(JSON.stringify({ ok: true, total: details.length, success, failed, healthy_after, details, blocked_groups: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
