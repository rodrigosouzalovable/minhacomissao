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
    if (!image || typeof image !== 'string') {
      return new Response(JSON.stringify({ error: 'Imagem não fornecida' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

    const systemPrompt = `Você extrai dados de prints da "Tabela - Desconto Especial" da UME.

Na imagem existe:
1. Uma tabela à direita com linhas no formato "Nx | R$ valor" (1x, 2x, 3x, ...). Cada linha é a quantidade de parcelas e o VALOR DE CADA PARCELA.
2. Um bloco "Total - Até 3x" com um valor (base de cálculo para 2x e 3x).
3. Um bloco "Total - 4x ou mais" com um valor (base de cálculo para 4 parcelas ou mais).

Regras:
- Converta valores brasileiros para número com ponto decimal e sem separador de milhar (ex.: "R$ 5.055" => 5055, "R$ 1.494,50" => 1494.5).
- Retorne TODAS as linhas da tabela que conseguir ler, em ordem crescente de parcelas.
- valor_avista = valor da linha 1x.
- Se algum total não estiver visível, retorne null para ele.
- Ignore textos de sistema operacional (ex.: "Ativar o Windows") e paginação ("1 - 1 / 1").`;

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
              { type: 'text', text: 'Extraia a tabela de desconto especial desta imagem:' },
              { type: 'image_url', image_url: { url: image } },
            ],
          },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_modelo_ume',
            description: 'Extrai a tabela de parcelamento e os totais da imagem UME',
            parameters: {
              type: 'object',
              properties: {
                valor_avista: { type: 'number', description: 'Valor da linha 1x (à vista)' },
                total_ate_3x: { type: 'number', description: 'Valor do bloco "Total - Até 3x"' },
                total_4x_ou_mais: { type: 'number', description: 'Valor do bloco "Total - 4x ou mais"' },
                parcelas: {
                  type: 'array',
                  description: 'Linhas da tabela de parcelas',
                  items: {
                    type: 'object',
                    properties: {
                      n: { type: 'number', description: 'Quantidade de parcelas' },
                      valor: { type: 'number', description: 'Valor de cada parcela' },
                    },
                    required: ['n', 'valor'],
                  },
                },
              },
              required: ['parcelas'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'extract_modelo_ume' } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos de IA esgotados. Adicione créditos.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw new Error(`Erro IA: ${response.status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('IA não retornou dados estruturados');
    const data = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro extract-modelo-ume:', error);
    const msg = error instanceof Error ? error.message : 'Erro ao processar imagem';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
