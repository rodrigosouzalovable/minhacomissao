import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const CAMPOS = ["primeiro_nome","nome","cpf","dias_atraso","fase","total_sem_juros","total_com_juros","total_proposta","avista","parcelas_lista","maior_parcelamento","menor_parcela","tabela"];
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser(auth.replace("Bearer ", ""));
    if (!u?.user) return json({ error: "nao_autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const texto = typeof body?.texto === "string" ? body.texto.slice(0, 4000) : "";
    const valores = body?.valores && typeof body.valores === "object" ? body.valores : {};
    if (!texto.trim()) return json({ error: "Cole um texto" }, 400);
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "IA indisponível" }, 500);

    const system = `Você transforma uma mensagem de cobrança em um MODELO reutilizável.
Troque por campos entre chaves as partes que mudam por cliente: nomes, CPF, valores em R$, quantidade de parcelas, dias de atraso, fase.
Campos permitidos (use somente estes): ${CAMPOS.map(c => `{${c}}`).join(", ")}.
Se houver uma lista de várias opções de parcelamento, troque a lista inteira por {parcelas_lista}.
Valores atuais do cliente (para reconhecer o que trocar): ${JSON.stringify(valores)}.
Mantenha o resto do texto, emojis, quebras de linha e formatação *negrito* exatamente iguais. Responda só com o modelo, sem explicações.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash-lite", messages: [{ role: "system", content: system }, { role: "user", content: texto }] }),
    });
    if (r.status === 429) return json({ error: "Muitas solicitações, tente em instantes" }, 429);
    if (r.status === 402) return json({ error: "Créditos de IA esgotados" }, 402);
    if (!r.ok) return json({ error: `IA falhou (${r.status})` }, 502);
    const d = await r.json();
    const modelo = String(d?.choices?.[0]?.message?.content || "").trim().replace(/^```\w*\n?|```$/g, "").trim();
    if (!modelo) return json({ error: "IA sem resposta" }, 502);
    return json({ modelo });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
