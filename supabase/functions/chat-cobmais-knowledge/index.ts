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

    const systemPrompt = `Você é a IA do sistema de automação CobMais. Seu papel é conversar com o administrador sobre o que você aprendeu nos treinamentos (sessões gravadas e vídeos narrados).

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
8. Se houver passos sem seletor CSS ou com descrição vaga, marque como ⚠️ (passo incompleto)`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-cobmais-knowledge error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
