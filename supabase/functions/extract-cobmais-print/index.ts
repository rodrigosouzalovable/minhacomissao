import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image } = await req.json();
    if (!image) throw new Error('Nenhuma imagem fornecida');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

    const systemPrompt = `Você extrai dados de prints de tela do sistema de cobrança Cob+/Novo Mundo.
Da imagem, identifique:
- Nome completo do cliente (geralmente em destaque no topo)
- CPF (formato XXX.XXX.XXX-XX)
- Número do contrato (sequência numérica, geralmente abaixo de "Contratos")
- Total em atraso (valor em R$ ao lado de "Total em Atraso")
- Data da última negociação (rótulo "Neg.:", formato DD/MM/AAAA) — opcional
- Sigla do credor (ex.: NM-I, NM-AP) — opcional
- Lista de parcelas: para cada linha da tabela, número da parcela, vencimento (DD/MM/AAAA), valor (numérico) e dias de atraso (numérico)

Retorne TODOS os campos numéricos sem formatação (sem R$, sem pontos de milhar, use ponto decimal).
Se um campo não estiver visível, omita ou retorne null.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extraia os dados deste print do Cob+:' },
              { type: 'image_url', image_url: { url: image } },
            ],
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_cobmais_data",
            description: "Extrai dados estruturados do print do Cob+",
            parameters: {
              type: "object",
              properties: {
                nome: { type: "string" },
                cpf: { type: "string" },
                contrato: { type: "string" },
                total_atraso: { type: "number" },
                neg_data: { type: "string", description: "DD/MM/AAAA" },
                credor_sigla: { type: "string" },
                parcelas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      numero: { type: "string" },
                      vencimento: { type: "string", description: "DD/MM/AAAA" },
                      valor: { type: "number" },
                      atraso: { type: "number" },
                    },
                    required: ["numero", "vencimento", "valor", "atraso"],
                  },
                },
              },
              required: ["nome", "total_atraso", "parcelas"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_cobmais_data" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições atingido. Aguarde alguns segundos.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos de IA esgotados. Adicione créditos para continuar.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Erro no gateway de IA: ${response.status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('Não foi possível extrair dados da imagem');

    const data = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro:', error);
    const msg = error instanceof Error ? error.message : 'Erro ao processar imagem';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
