// get-group-jid: lista grupos WhatsApp de uma instância UAZAPI (nome + JID).
// Body: { instance_id: uuid, name_contains?: string }
// Retorna { ok, endpoint_used, instance_id, instance_name, total, groups: [{jid,nome,participants_count,is_admin}] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizeGroup(g: any) {
  const jid = g?.jid || g?.id || g?.groupJid || g?.group_id || g?.remoteJid || g?.chatId || "";
  const nome = g?.name || g?.subject || g?.nome || g?.groupName || g?.title || "";
  const participants = g?.participants || g?.members || g?.participantsList || [];
  const participants_count =
    g?.size ?? g?.participantsCount ?? g?.participants_count ?? (Array.isArray(participants) ? participants.length : undefined);
  const is_admin = g?.isAdmin ?? g?.iAmAdmin ?? g?.is_admin ?? undefined;
  return { jid, nome, participants_count, is_admin, raw: undefined as any };
}

function extractGroupArray(parsed: any): any[] {
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.groups)) return parsed.groups;
  if (Array.isArray(parsed?.data)) return parsed.data;
  if (Array.isArray(parsed?.result)) return parsed.result;
  if (Array.isArray(parsed?.response)) return parsed.response;
  if (Array.isArray(parsed?.chats)) return parsed.chats.filter((c: any) => String(c?.id || c?.jid || "").endsWith("@g.us"));
  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const instance_id: string | undefined = body?.instance_id;
    const name_contains: string | undefined = body?.name_contains;

    if (!instance_id) return json({ ok: false, error: "instance_id obrigatório" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: inst, error } = await supabase
      .from("user_whatsapp_instances")
      .select("id, nome, server_url, instance_token")
      .eq("id", instance_id)
      .maybeSingle();

    if (error || !inst) return json({ ok: false, error: "Instância não encontrada" }, 404);

    const base = String(inst.server_url || "").replace(/\/+$/, "");
    const token = inst.instance_token;

    const attempts = [
      { method: "GET", path: "/group/list" },
      { method: "POST", path: "/group/list", body: {} },
      { method: "GET", path: "/group/fetchAllGroups" },
      { method: "GET", path: "/chat/getGroups" },
      { method: "GET", path: "/instance/groups" },
      { method: "GET", path: "/instance/groupsList" },
    ];

    let lastErr = "";
    for (const a of attempts) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 20000);
        const init: RequestInit = {
          method: a.method,
          headers: { token, "Content-Type": "application/json" },
          signal: ctrl.signal,
        };
        if (a.method === "POST") init.body = JSON.stringify(a.body || {});
        const res = await fetch(`${base}${a.path}`, init);
        clearTimeout(t);

        const text = await res.text();
        let parsed: any = null;
        try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }

        const lower = text.toLowerCase();
        if (lower.includes("disconnected") || lower.includes("not connected")) {
          return json({ ok: false, fallback: true, reason: "disconnected", instance_id: inst.id, instance_name: inst.nome });
        }

        if (!res.ok) {
          lastErr = `${a.method} ${a.path} -> ${res.status}: ${text.substring(0, 150)}`;
          continue;
        }

        const arr = extractGroupArray(parsed);
        if (!arr || arr.length === 0) {
          // Endpoint respondeu OK mas sem grupos — pode ser endpoint errado, tentar próximo
          lastErr = `${a.method} ${a.path} -> sem grupos`;
          continue;
        }

        let groups = arr.map(normalizeGroup).filter((g) => g.jid);
        if (name_contains && name_contains.trim()) {
          const q = name_contains.toLowerCase();
          groups = groups.filter((g) => String(g.nome || "").toLowerCase().includes(q));
        }

        return json({
          ok: true,
          endpoint_used: `${a.method} ${a.path}`,
          instance_id: inst.id,
          instance_name: inst.nome,
          total: groups.length,
          groups,
        });
      } catch (e) {
        lastErr = `${a.method} ${a.path} -> ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    return json({ ok: false, error: "Nenhum endpoint UAZAPI retornou grupos", last_error: lastErr, instance_id: inst.id, instance_name: inst.nome });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
