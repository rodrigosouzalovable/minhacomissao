const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("OLLAMA_NGROK_URL") || "";
  const model = Deno.env.get("OLLAMA_MODEL") || "gemma4:e4b";
  const apiKey = Deno.env.get("OLLAMA_API_KEY") || "";
  const clean = url.replace(/\/+$/, "");

  const out: any = { url, model, hasApiKey: !!apiKey, tests: [] };

  // 1. GET /
  try {
    const r = await fetch(`${clean}/`, { headers: { "ngrok-skip-browser-warning": "true" } });
    out.tests.push({ name: "GET /", status: r.status, body: (await r.text()).substring(0, 300), headers: Object.fromEntries(r.headers) });
  } catch (e) { out.tests.push({ name: "GET /", error: String(e) }); }

  // 2. GET /api/tags
  try {
    const r = await fetch(`${clean}/api/tags`, { headers: { "ngrok-skip-browser-warning": "true", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) } });
    out.tests.push({ name: "GET /api/tags", status: r.status, body: (await r.text()).substring(0, 400), headers: Object.fromEntries(r.headers) });
  } catch (e) { out.tests.push({ name: "GET /api/tags", error: String(e) }); }

  // 3. POST /api/chat
  try {
    const r = await fetch(`${clean}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "oi" }], stream: false, options: { num_predict: 20 } }),
    });
    out.tests.push({ name: "POST /api/chat", status: r.status, body: (await r.text()).substring(0, 500), headers: Object.fromEntries(r.headers) });
  } catch (e) { out.tests.push({ name: "POST /api/chat", error: String(e) }); }

  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
