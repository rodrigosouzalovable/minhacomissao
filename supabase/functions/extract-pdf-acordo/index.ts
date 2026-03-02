import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64 } = await req.json();

    if (!pdfBase64) {
      throw new Error('Nenhum PDF fornecido');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não está configurada');
    }

    console.log('Recebido PDF para extração de dados do acordo');

    const systemPrompt = `Você é um especialista em extrair dados de documentos de cálculo de débito e acordos de cobrança brasileiros.
Analise o PDF fornecido e extraia as seguintes informações:

1. Valor total negociado/acordo - procure por "Valor Total", "Total do Acordo", "Valor Negociado", ou a soma dos valores
2. Número de parcelas - procure por quantas parcelas existem no documento, conte as linhas de parcelas
3. Data do primeiro vencimento - a data da primeira parcela, formato AAAA-MM-DD

IMPORTANTE:
- Analise tabelas com parcelas, datas de vencimento e valores
- Se houver uma tabela com parcelas numeradas, conte quantas parcelas existem
- O valor total é geralmente a soma de todas as parcelas
- A data do primeiro vencimento é a data da parcela 1 ou a primeira data listada
- Retorne valores numéricos sem formatação (sem R$, sem pontos de milhar, use ponto como separador decimal)
- Para datas, retorne no formato AAAA-MM-DD`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extraia os dados de parcelas e valores deste documento PDF de cálculo de débito/acordo:',
              },
              {
                type: 'image_url',
                image_url: {
                  url: pdfBase64.startsWith('data:') ? pdfBase64 : `data:application/pdf;base64,${pdfBase64}`,
                },
              },
            ],
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_pdf_acordo_data",
            description: "Extrai dados estruturados do PDF de acordo/cálculo de débito",
            parameters: {
              type: "object",
              properties: {
                valor_total: { 
                  type: "number",
                  description: "Valor total do acordo/negociação em reais (ex: 5000.00)"
                },
                num_parcelas: { 
                  type: "number",
                  description: "Número total de parcelas"
                },
                data_primeiro_vencimento: { 
                  type: "string",
                  description: "Data do primeiro vencimento no formato AAAA-MM-DD"
                },
              },
              required: ["valor_total", "num_parcelas", "data_primeiro_vencimento"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "extract_pdf_acordo_data" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro no AI Gateway:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Taxa de requisições excedida. Tente novamente em alguns segundos.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`Erro no gateway de IA: ${response.status}`);
    }

    const result = await response.json();
    console.log('Resposta da IA:', JSON.stringify(result, null, 2));

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'extract_pdf_acordo_data') {
      throw new Error('Não foi possível extrair dados do PDF');
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
    console.log('Dados extraídos:', extractedData);

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na extração:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao processar PDF';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
