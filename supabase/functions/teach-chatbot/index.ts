import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você é um assistente de treinamento para um chatbot de cobrança. O administrador vai te ensinar regras de resposta para o chatbot.

Seu trabalho:
1. Entender o que o admin quer ensinar (gatilho + resposta)
2. Confirmar com o admin antes de salvar
3. Quando o admin confirmar, responder com um JSON especial

FLUXO:
- O admin diz algo como "quando o cliente perguntar sobre boleto, responda X"
- Você extrai o GATILHO (palavra-chave que o cliente vai dizer) e a RESPOSTA (o que o chatbot deve responder)
- Você confirma: "Entendi! Quando o cliente disser algo como **[gatilho]**, vou responder: **[resposta]**. Posso salvar essa regra?"
- Se o admin confirmar (sim, pode, salva, confirmo, etc), responda EXATAMENTE neste formato JSON:
  {"action":"save","gatilho":"[gatilho extraído]","resposta":"[resposta extraída]","message":"Regra salva! ✅ Agora quando o cliente mencionar '[gatilho]', vou responder automaticamente. Quer me ensinar mais alguma coisa?"}
- Se o admin negar ou quiser ajustar, peça para reformular

REGRAS:
- Seja simpático e conversacional
- Use emojis moderadamente
- O gatilho deve ser curto (1-4 palavras chave)
- A resposta pode ser mais longa
- Se o admin não for claro, peça mais detalhes
- Quando o admin só fizer uma pergunta genérica ou saudação, responda normalmente sem tentar criar regra
- NUNCA invente gatilhos ou respostas. Use EXATAMENTE o que o admin definiu
- O JSON deve ser a resposta COMPLETA quando for salvar (não misture texto + JSON)`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const aiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m: any) => ({ role: m.role, content: m.content }))
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: aiMessages,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Desculpe, não consegui processar. Tente novamente.';

    // Check if the AI wants to save a rule
    let regraCriada = false;
    let finalReply = reply;

    try {
      const parsed = JSON.parse(reply);
      if (parsed.action === 'save' && parsed.gatilho && parsed.resposta) {
        // Save the rule to the database
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { error } = await supabase
          .from('chatbot_regras')
          .insert({
            gatilho: parsed.gatilho,
            resposta: parsed.resposta,
          });

        if (error) {
          console.error('Error saving rule:', error);
          finalReply = 'Ops, tive um problema ao salvar a regra. Pode tentar novamente? 😅';
        } else {
          regraCriada = true;
          finalReply = parsed.message || 'Regra salva com sucesso! ✅ Quer me ensinar mais alguma coisa?';
        }
      }
    } catch {
      // Not JSON, normal text response - that's fine
    }

    return new Response(
      JSON.stringify({ reply: finalReply, regra_criada: regraCriada }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in teach-chatbot:', error);
    return new Response(
      JSON.stringify({ reply: 'Erro interno. Tente novamente.', regra_criada: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
