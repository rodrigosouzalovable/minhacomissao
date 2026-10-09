import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createResponsesCall } from '../_shared/responses.ts';
import { getLovableAiGatewayResponseHeaders } from '../_shared/run-id.ts';

const nullableString = { type: ['string', 'null'] };
const nullableNumber = { type: ['number', 'null'] };
export const agreementSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    cliente_nome: nullableString, cliente_cpf: nullableString,
    cliente_telefone: nullableString, valor_total: nullableNumber,
    parcelas: nullableNumber, valor_parcela: nullableNumber,
    data_primeiro_pagamento: nullableString, dias_atraso: nullableNumber,
    empresa: { type: ['string', 'null'], enum: ['ume_novo_mundo', 'mundo_da_moda', 'odres_cred', null] },
    parcelas_detalhadas: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      properties: { numero_parcela: { type: 'number' }, data_vencimento: { type: 'string' }, valor: { type: 'number' } },
      required: ['numero_parcela', 'data_vencimento', 'valor'],
    } },
  },
  required: ['cliente_nome', 'cliente_cpf', 'cliente_telefone', 'valor_total', 'parcelas', 'valor_parcela', 'data_primeiro_pagamento', 'dias_atraso', 'empresa', 'parcelas_detalhadas'],
};

const prompt = `Extraia apenas os dados visíveis de um acordo brasileiro da imagem.
Nome e CPF pertencem ao CLIENTE. Total é o valor NEGOCIADO (total das parcelas), nunca dívida antes do desconto.
Se houver uma tabela completa de parcelas, extraia TODAS as linhas com número, vencimento AAAA-MM-DD e valor em reais; não use linha digitável como valor.
Ano abreviado /26 é 2026, /27 é 2027. Não desloque dias por fuso horário.
Se houver apenas resumo Nx valor, retorne parcelas_detalhadas vazio: não invente vencimentos individuais.
Telefone, dias_atraso e empresa devem ser null: preenchidos manualmente pelo operador. Nunca use telefone de suporte ou do rodapé.
Para demais informações ausentes retorne null. Retorne somente o objeto JSON pedido, sem explicações.`;

function json(body: unknown, status = 200, headers: HeadersInit = corsHeaders) {
  return new Response(JSON.stringify(body), { status, headers: getLovableAiGatewayResponseHeaders(undefined, { ...Object.fromEntries(new Headers(headers)), 'Content-Type': 'application/json' }) });
}

serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  try {
    const auth = req.headers.get('Authorization');
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    if (!auth?.startsWith('Bearer ') || !url || !anon) return json({ error: 'Sessão inválida. Entre novamente.' }, 401);
    const client = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: claims, error: authError } = await client.auth.getClaims(auth.slice(7));
    if (authError || !claims?.claims?.sub) return json({ error: 'Sessão inválida. Entre novamente.' }, 401);
    const { image } = await req.json();
    if (typeof image !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(image) || image.length > 14 * 1024 * 1024) {
      return json({ error: 'Envie uma imagem PNG, JPG ou WEBP de até 10 MB.' }, 400);
    }
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return json({ error: 'Leitura de prints indisponível: configuração de Lovable AI ausente.' }, 503);
    // Streamed SDK response consumed for this one-shot extraction. No automatic retries.
    const { result } = createResponsesCall(req, {
      baseURL: 'https://ai.gateway.lovable.dev/v1', apiKey: key, model: 'openai/gpt-6-astra',
    }, [{ role: 'user', content: [{ type: 'image', image: new URL(image) }] }], prompt,
      { schema: agreementSchema, schemaName: 'acordo_documento' });
    const text = await result.text;
    if (!text.trim()) return json({ error: 'A leitura não retornou dados. Confira o documento.' }, 422);
    const extracted = JSON.parse(text);
    if (!extracted.cliente_nome && !extracted.cliente_cpf && !extracted.valor_total) {
      return json({ error: 'Não foi possível reconhecer um acordo nesta imagem.' }, 422);
    }
    extracted.cliente_telefone = null;
    extracted.dias_atraso = null;
    extracted.empresa = null;
    const providerResponse = await result.response;
    return json({ success: true, data: extracted }, 200, getLovableAiGatewayResponseHeaders(providerResponse.headers, corsHeaders));
  } catch (error) {
    if (req.signal.aborted) return json({ error: 'Leitura cancelada.' }, 499);
    const status = error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 500;
    let message = error instanceof Error ? error.message : 'Não foi possível ler a imagem.';
    if (error && typeof error === 'object' && 'responseBody' in error && typeof error.responseBody === 'string') {
      try { const detail = JSON.parse(error.responseBody); message = detail.message || detail.error?.message || message; } catch { /* keep safe SDK message */ }
    }
    return json({ error: message }, [400, 401, 402, 403, 404, 429].includes(status) ? status : 500);
  }
});
