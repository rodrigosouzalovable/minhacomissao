// Gera ideias de templates HSM para aquecimento (admin-only), via Lovable AI.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (p: unknown, status = 200) =>
    new Response(JSON.stringify(p), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "config", message: "LOVABLE_API_KEY não configurada" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "nao_autenticado" }, 401);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "nao_autenticado" }, 401);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "apenas_admin" }, 403);

    const body = await req.json().catch(() => ({}));
    const categoria = String(body?.categoria || "UTILITY").toUpperCase();
    const tema = String(body?.tema || "aquecimento de número novo com alta taxa de resposta").slice(0, 300);
    const qtd = Math.min(Math.max(Number(body?.quantidade ?? 3), 1), 5);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          {
            role: "system",
            content:
              "Você cria templates HSM do WhatsApp Cloud API em português do Brasil, seguindo as políticas da Meta. " +
              "Regras: nome do template em snake_case minúsculo; corpo curto e claro; use no máximo 2 variáveis no formato {{1}} e {{2}}; " +
              "nunca prometa nada falso; UTILITY exige contexto de transação/serviço solicitado; MARKETING pode ser promocional. " +
              "Nunca use conteúdo enganoso ou proibido pela Meta.",
          },
          {
            role: "user",
            content: `Gere ${qtd} ideias de template da categoria ${categoria} para: ${tema}. Idioma pt_BR.`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "ideias_templates",
            description: "Lista de ideias de templates",
            parameters: {
              type: "object",
              properties: {
                ideias: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      nome_sugerido: { type: "string" },
                      categoria: { type: "string" },
                      corpo: { type: "string" },
                      botoes: { type: "array", items: { type: "string" } },
                      justificativa: { type: "string" },
                    },
                    required: ["nome_sugerido", "corpo", "justificativa"],
                  },
                },
              },
              required: ["ideias"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "ideias_templates" } },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      if (resp.status === 429) return json({ error: "limite_ia", message: "Muitas requisições de IA agora. Tente em alguns segundos." }, 429);
      if (resp.status === 402) return json({ error: "creditos_ia", message: "Créditos de IA esgotados." }, 402);
      return json({ error: "falha_ia", message: `Erro da IA (${resp.status})`, details: txt.slice(0, 400) }, 502);
    }

    const aiJson = await resp.json();
    const call = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) return json({ error: "sem_resultado", message: "A IA não retornou dados estruturados" }, 502);
    const ideias = JSON.parse(call.function.arguments).ideias ?? [];

    const rows = ideias.slice(0, qtd).map((i: any) => ({
      nome_sugerido: String(i.nome_sugerido || "template_aquecimento").toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 60),
      categoria: String(i.categoria || categoria).toUpperCase() === "MARKETING" ? "MARKETING" : "UTILITY",
      idioma: "pt_BR",
      corpo: String(i.corpo || "").slice(0, 1024),
      botoes: Array.isArray(i.botoes) ? i.botoes.slice(0, 3) : [],
      justificativa: String(i.justificativa || "").slice(0, 600),
      status: "rascunho",
      criado_por: user.id,
    }));

    const { data: salvos, error } = await supabase.from("meta_template_ideias").insert(rows).select();
    if (error) throw error;

    return json({ ok: true, ideias: salvos });
  } catch (e) {
    console.error("[meta-template-ideias-gerar]", e);
    return json({ error: "erro_interno", message: e instanceof Error ? e.message : "erro" }, 500);
  }
});
