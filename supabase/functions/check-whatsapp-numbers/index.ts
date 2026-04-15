const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  return clean.startsWith('55') ? clean : `55${clean}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { numbers, server_url, instance_token } = await req.json();

    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return jsonResponse({ error: 'numbers array é obrigatório' }, 400);
    }
    if (!server_url || !instance_token) {
      return jsonResponse({ error: 'server_url e instance_token são obrigatórios' }, 400);
    }

    const cleanUrl = server_url.replace(/\/+$/, '');
    const formattedNumbers = numbers.map((n: string) => formatPhone(n));

    const valid: string[] = [];
    const invalid: string[] = [];
    const errors: string[] = [];

    // Process in batches of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < formattedNumbers.length; i += BATCH_SIZE) {
      const batch = formattedNumbers.slice(i, i + BATCH_SIZE);
      const originalBatch = numbers.slice(i, i + BATCH_SIZE);

      try {
        console.log(`Verificando lote ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} números`);
        
        const response = await fetch(`${cleanUrl}/chat/check`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': instance_token,
          },
          body: JSON.stringify({ numbers: batch }),
        });

        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          console.error(`Resposta não-JSON: ${text.slice(0, 200)}`);
          // If we can't parse, mark all as errors
          originalBatch.forEach((n: string) => errors.push(n));
          continue;
        }

        console.log(`Resposta lote: ${JSON.stringify(data).slice(0, 500)}`);

        if (!response.ok) {
          console.error(`Erro HTTP ${response.status}: ${JSON.stringify(data)}`);
          originalBatch.forEach((n: string) => errors.push(n));
          continue;
        }

        // UAZAPI returns array of objects with { number, exists } or similar
        // Handle different response formats
        if (Array.isArray(data)) {
          data.forEach((item: any, idx: number) => {
            const originalNumber = originalBatch[idx] || batch[idx];
            const hasWhatsApp = item.exists === true || item.numberExists === true || 
                               item.status === 'valid' || item.isRegistered === true ||
                               item.result === 'exists' || item.onWhatsapp === true;
            if (hasWhatsApp) {
              valid.push(originalNumber);
            } else {
              invalid.push(originalNumber);
            }
          });
        } else if (data.numbers && Array.isArray(data.numbers)) {
          data.numbers.forEach((item: any, idx: number) => {
            const originalNumber = originalBatch[idx] || batch[idx];
            const hasWhatsApp = item.exists === true || item.numberExists === true ||
                               item.status === 'valid' || item.isRegistered === true ||
                               item.result === 'exists' || item.onWhatsapp === true;
            if (hasWhatsApp) {
              valid.push(originalNumber);
            } else {
              invalid.push(originalNumber);
            }
          });
        } else if (data.result && Array.isArray(data.result)) {
          data.result.forEach((item: any, idx: number) => {
            const originalNumber = originalBatch[idx] || batch[idx];
            const hasWhatsApp = item.exists === true || item.numberExists === true ||
                               item.status === 'valid' || item.isRegistered === true ||
                               item.result === 'exists' || item.onWhatsapp === true;
            if (hasWhatsApp) {
              valid.push(originalNumber);
            } else {
              invalid.push(originalNumber);
            }
          });
        } else {
          // Unknown format — log and add all as errors
          console.error(`Formato de resposta desconhecido: ${JSON.stringify(data).slice(0, 300)}`);
          originalBatch.forEach((n: string) => errors.push(n));
        }

        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < formattedNumbers.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error(`Erro no lote: ${msg}`);
        originalBatch.forEach((n: string) => errors.push(n));
      }
    }

    return jsonResponse({
      valid,
      invalid,
      errors,
      total: numbers.length,
      total_valid: valid.length,
      total_invalid: invalid.length,
      total_errors: errors.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return jsonResponse({ error: message }, 500);
  }
});
