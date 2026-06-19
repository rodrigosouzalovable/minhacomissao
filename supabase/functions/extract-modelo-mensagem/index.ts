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

    const systemPrompt = `Você extrai dados de prints de sistemas de cobrança brasileiros (Cob+/Cobmais).
Da imagem fornecida, identifique:

1. nome — Nome completo do cliente (geralmente em destaque no topo, em letras maiúsculas). Não inclua data de nascimento nem idade.
2. cpf — CPF do cliente, formato XXX.XXX.XXX-XX. Aparece após "CPF:" ou similar.
3. contrato — Número do contrato. Geralmente um número longo (8+ dígitos) listado abaixo de "Contratos", com bullet/ponto colorido.
4. dias_atraso — APENAS o número após o texto "Atraso:" (ex.: "NM-I - Atraso: 155" => 155). NÃO confunda com a quantidade de telefones, número do contrato ou CEP.
5. qtd_parcelas_atraso — Quantidade de parcelas em atraso. Se houver um pequeno círculo numerado próximo ao contrato (ex.: "2"), use esse valor. Se não conseguir identificar, retorne 1.
6. total_atraso — Valor numérico em reais, sem símbolo, sem separador de milhar, com ponto decimal (ex.: "R$ 1.086,69" => 1086.69). Procure por "Total em Atraso" ou similar.

Se algum campo não for encontrado com clareza, retorne null para ele (exceto qtd_parcelas_atraso, que default = 1).`;

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
              { type: 'text', text: 'Extraia os dados desta tela de cobrança:' },
              { type: 'image_url', image_url: { url: image } },
            ],
          },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_modelo_mensagem',
            description: 'Extrai dados estruturados do print de cobrança',
            parameters: {
              type: 'object',
              properties: {
                nome: { type: 'string', description: 'Nome completo do cliente' },
                cpf: { type: 'string', description: 'CPF no formato XXX.XXX.XXX-XX' },
                contrato: { type: 'string', description: 'Número do contrato' },
                dias_atraso: { type: 'number', description: 'Dias de atraso após "Atraso:"' },
                qtd_parcelas_atraso: { type: 'number', description: 'Quantidade de parcelas em atraso (default 1)' },
                total_atraso: { type: 'number', description: 'Total em atraso em reais (ex.: 1086.69)' },
              },
              required: ['nome', 'cpf', 'dias_atraso', 'total_atraso'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'extract_modelo_mensagem' } },
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
    console.error('Erro extract-modelo-mensagem:', error);
    const msg = error instanceof Error ? error.message : 'Erro ao processar imagem';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
