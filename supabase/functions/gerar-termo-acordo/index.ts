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
    const { descricaoAcordo, clienteNome, clienteCpf, credor, valorTotal, contratos } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Dados jurídicos completos dos credores
    const credoresJuridicos: Record<string, string> = {
      'MONTREAL': 'MONTREAL - MONTADORA DE MÓVEIS E ELETRO-DOMÉSTICOS LTDA., pessoa jurídica de direito privado, inscrita no CNPJ nº 07.019.882/0001-86, com sede na Av. Eurípedes de Menezes, qd. 04, lts. 01/13 e 28/36, Setor Parque Industrial, CEP: 74993-540, Aparecida de Goiânia-GO',
    };

    const credorNormalizado = (credor || '').toUpperCase().trim();
    const credorCompleto = credoresJuridicos[credorNormalizado] || credor || 'Não informado';
    const isMontreal = credorNormalizado === 'MONTREAL';

    // Cláusula obrigatória para Montreal
    const clausulaMontrealBaixa = isMontreal ? `

IMPORTANTE: O termo DEVE conter obrigatoriamente a seguinte cláusula (pode ser a CLÁUSULA QUARTA ou outra numeração adequada):

CLÁUSULA [NÚMERO] - DAS RESPONSABILIDADES PELA BAIXA DE PENDÊNCIAS

É de inteira e exclusiva responsabilidade da DEVEDORA o pagamento de quaisquer custas, taxas e emolumentos cartorários necessários à baixa de protestos ou pendências existentes em seu nome e no de suas filiais.

PARÁGRAFO ÚNICO: A CREDORA compromete-se a fornecer a Carta de Anuência para cancelamento dos protestos em cartório somente após o recebimento integral e a efetiva compensação das parcelas pactuadas neste instrumento, devendo a DEVEDORA providenciar o protocolo e pagamento das custas perante os respectivos tabelionatos.` : '';

    const systemPrompt = `Você é um advogado brasileiro com mais de 20 anos de experiência em direito civil e empresarial, especializado em acordos extrajudiciais de cobrança. Você redige termos de acordo extrajudiciais completos e profissionais.

INSTRUÇÕES:
- Gere um TERMO DE ACORDO EXTRAJUDICIAL completo e profissional
- Use linguagem jurídica formal e precisa
- Inclua todas as cláusulas necessárias: qualificação das partes, objeto, condições de pagamento, multas, penalidades, foro, disposições gerais
- NÃO mencione inteligência artificial em nenhum momento
- Retorne APENAS o texto puro do termo, sem formatação markdown (sem **, ##, etc.)
- Use numeração de cláusulas (CLÁUSULA PRIMEIRA, CLÁUSULA SEGUNDA, etc.)
- Inclua espaços para assinatura das partes e testemunhas ao final
- Use a data atual para o termo
- Seja detalhista nas cláusulas de inadimplemento e penalidades`;

    const userPrompt = `Gere um Termo de Acordo Extrajudicial com base nas seguintes informações:

DADOS DO DEVEDOR:
- Nome: ${clienteNome}
- CPF/CNPJ: ${clienteCpf}

CREDOR: ${credorCompleto}

VALOR TOTAL DA DÍVIDA: R$ ${valorTotal ? Number(valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : 'Não informado'}

${contratos ? `CONTRATOS EM ABERTO:\n${contratos}` : ''}

DESCRIÇÃO DO ACORDO FEITO:
${descricaoAcordo}
${clausulaMontrealBaixa}

Gere o termo completo e profissional.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Taxa de requisições excedida. Tente novamente em alguns segundos.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes. Por favor, adicione créditos à sua conta.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    const termoGerado = result.choices?.[0]?.message?.content || '';

    // Remove any markdown formatting that might slip through
    const termoLimpo = termoGerado
      .replace(/\*\*/g, '')
      .replace(/##\s*/g, '')
      .replace(/###\s*/g, '')
      .replace(/`/g, '');

    return new Response(
      JSON.stringify({ termo: termoLimpo }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating termo:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar termo de acordo';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
