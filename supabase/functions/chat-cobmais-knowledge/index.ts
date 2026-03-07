import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = claimsData.claims.sub;
    const { messages } = await req.json();

    // Fetch all knowledge data using service role
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [sessionsRes, knowledgeRes] = await Promise.all([
      adminClient.from("cobmais_sessoes_gravadas").select("*").order("criado_em", { ascending: false }),
      adminClient.from("cobmais_conhecimento").select("*").order("sessao_id, passo_numero"),
    ]);

    const sessions = sessionsRes.data || [];
    const knowledge = knowledgeRes.data || [];

    // Build knowledge context
    let knowledgeContext = "";
    if (sessions.length === 0) {
      knowledgeContext = "NENHUM CONHECIMENTO FOI GRAVADO AINDA. Não há sessões de treinamento nem vídeos processados.";
    } else {
      knowledgeContext = sessions.map(s => {
        const steps = knowledge.filter(k => k.sessao_id === s.id);
        const stepsText = steps.map(k => 
          `  Passo ${k.passo_numero}: ação="${k.acao}" | seletor="${k.seletor || 'N/A'}" | valor="${k.valor || 'N/A'}" | descrição="${k.descricao_tela || 'N/A'}" | url="${k.url_pagina || 'N/A'}"`
        ).join("\n");
        return `FLUXO: "${s.nome}" (status: ${s.status}, ${s.total_passos} passos, gravado em ${s.criado_em})\n${s.descricao ? `Descrição: ${s.descricao}\n` : ""}${stepsText || "  (sem passos registrados)"}`;
      }).join("\n\n");
    }

    const systemPrompt = `Você é a IA do sistema de automação CobMais. Seu papel é conversar com o administrador sobre o que você aprendeu nos treinamentos E também EXECUTAR ações quando solicitado.

## Seu conhecimento atual:
${knowledgeContext}

## Regras:
1. Responda SEMPRE em português brasileiro
2. Quando perguntado sobre o que sabe fazer, analise os fluxos gravados e descreva com clareza
3. Se um passo está vago (sem seletor, sem descrição clara, ação genérica), IDENTIFIQUE como uma LACUNA e diga explicitamente: "📹 **Sugiro que envie um novo vídeo explicando [descreva o que falta]**"
4. Se perguntado sobre algo que NÃO está nos seus fluxos gravados, diga que ainda não aprendeu e sugira: "📹 **Envie um vídeo de treinamento mostrando como fazer [X]**"
5. Seja honesto sobre o que sabe e o que não sabe
6. Use markdown para formatar as respostas (listas, negrito, etc.)
7. Quando listar passos de um fluxo, mostre de forma clara e numerada
8. Se houver passos sem seletor CSS ou com descrição vaga, marque como ⚠️ (passo incompleto)

## IMPORTANTE - Execução de ações (MODO PASSO A PASSO):
9. Quando o usuário PEDIR para executar algo, você DEVE usar a tool "executar_automacao" passando o objetivo em linguagem natural
10. NÃO apenas descreva os passos — EXECUTE chamando a tool
11. A cada comando, o robô executa APENAS UMA AÇÃO (1 iteração). Depois ele para e espera o próximo comando do usuário.
12. Após executar, SEMPRE confirme ao usuário o que foi feito. Diga algo como: "✅ **Feito!** Naveguei até [URL]. Veja o resultado no streaming acima. O que devo fazer agora?"
13. Exemplos de quando executar: "acesse o link X", "pesquise pelo CPF Y", "clique no botão Z", "preencha o campo com valor W"
14. Exemplos de quando NÃO executar: "o que você sabe fazer?", "quais fluxos você aprendeu?", "explique como funciona"

## IMPORTANTE - Confirmação após cada ação:
15. SEMPRE pergunte ao usuário qual o próximo passo após confirmar a execução
16. Se o usuário disser "acesse o link X e depois pesquise Y", execute APENAS o primeiro passo (acessar o link) e depois pergunte se pode prosseguir com o segundo
17. Informe que o usuário pode acompanhar em tempo real no **"Streaming do Robô"** acima do chat
18. Se o usuário reportar um problema após a execução, pergunte detalhes e sugira enviar um vídeo de treinamento se necessário`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const tools = [
      {
        type: "function",
        function: {
          name: "executar_automacao",
          description: "Executa uma ação de automação no robô CobMais. Use quando o usuário pedir para executar, emitir, gerar, buscar ou fazer qualquer ação no sistema CobMais.",
          parameters: {
            type: "object",
            properties: {
              objetivo: {
                type: "string",
                description: "Descrição em linguagem natural do que deve ser feito, ex: 'Emitir boleto à vista do CPF 059.919.151-13 por R$ 300,00 para pagamento em 10/03/2026'"
              }
            },
            required: ["objetivo"],
            additionalProperties: false
          }
        }
      }
    ];

    // 1st call: non-streaming, with tools, to decide if we need to execute
    console.log("[chat-cobmais-knowledge] 1st call: checking for tool usage...");
    const firstResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools,
        stream: false,
      }),
    });

    if (!firstResponse.ok) {
      if (firstResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (firstResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await firstResponse.text();
      console.error("AI gateway error (1st call):", firstResponse.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstResult = await firstResponse.json();
    const firstChoice = firstResult.choices?.[0];
    const toolCalls = firstChoice?.message?.tool_calls;

    let finalMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    if (toolCalls && toolCalls.length > 0) {
      // AI wants to call the tool
      const toolCall = toolCalls[0];
      const args = JSON.parse(toolCall.function.arguments || "{}");
      const objetivo = args.objetivo;

      console.log(`[chat-cobmais-knowledge] Tool called: executar_automacao, objetivo: ${objetivo}`);

      // Fire-and-forget: dispatch automation WITHOUT awaiting
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      fetch(`${supabaseUrl}/functions/v1/automacao-cobmais`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          action: "agent_execute",
          objetivo,
          parametros: {},
          _internal: true,
        }),
      }).then(res => res.text()).then(t => {
        console.log("[chat-cobmais-knowledge] Automation dispatched, response:", t.substring(0, 200));
      }).catch(err => {
        console.error("[chat-cobmais-knowledge] Automation dispatch error:", err);
      });

      const toolResultContent = `Automação disparada com sucesso em background! Objetivo: "${objetivo}". O robô já está executando. O usuário pode acompanhar em tempo real na seção "Streaming do Robô" na tela.`;

      finalMessages = [
        ...finalMessages,
        firstChoice.message,
        {
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResultContent,
        },
      ];
    } else if (firstChoice?.message?.content) {
      finalMessages = [
        ...finalMessages,
      ];
    }

    // 2nd call: streaming, with full context
    console.log("[chat-cobmais-knowledge] 2nd call: streaming final response...");
    const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: finalMessages,
        stream: true,
      }),
    });

    if (!streamResponse.ok) {
      const t = await streamResponse.text();
      console.error("AI gateway error (2nd call):", streamResponse.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(streamResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-cobmais-knowledge error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
