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

    const BATCH_SIZE = 15;
    const CONCURRENCY = 3;
    const REQUEST_TIMEOUT_MS = 45000;
    const MAX_RETRIES = 1;

    // Build all batches
    const batches: { batch: string[]; originalBatch: string[]; index: number }[] = [];
    for (let i = 0; i < formattedNumbers.length; i += BATCH_SIZE) {
      batches.push({
        batch: formattedNumbers.slice(i, i + BATCH_SIZE),
        originalBatch: numbers.slice(i, i + BATCH_SIZE),
        index: Math.floor(i / BATCH_SIZE) + 1,
      });
    }

    const processItem = (item: any, originalNumber: string) => {
      const hasWhatsApp = item.isInWhatsapp === true ||
                         item.exists === true ||
                         item.numberExists === true ||
                         item.onWhatsapp === true;
      if (hasWhatsApp) {
        valid.push(originalNumber);
      } else {
        invalid.push(originalNumber);
      }
    };

    const tryFetchBatch = async ({ batch, originalBatch, index }: { batch: string[]; originalBatch: string[]; index: number }, attempt: number): Promise<'ok' | 'retry' | 'fail'> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        console.log(`Verificando lote ${index} (tentativa ${attempt + 1}): ${batch.length} números`);
        const response = await fetch(`${cleanUrl}/chat/check`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': instance_token,
          },
          body: JSON.stringify({ numbers: batch }),
          signal: controller.signal,
        });

        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          console.error(`Lote ${index}: resposta não-JSON: ${text.slice(0, 200)}`);
          return 'retry';
        }

        if (data?.code === 504 || data?.message === 'Request timeout') {
          console.error(`Lote ${index}: timeout reportado pela UAZAPI`);
          return 'retry';
        }

        if (!response.ok) {
          console.error(`Lote ${index}: HTTP ${response.status} ${JSON.stringify(data).slice(0, 200)}`);
          // 4xx is unlikely to recover; 5xx may
          return response.status >= 500 ? 'retry' : 'fail';
        }

        const arr = Array.isArray(data)
          ? data
          : Array.isArray(data?.numbers)
          ? data.numbers
          : Array.isArray(data?.result)
          ? data.result
          : null;

        if (!arr) {
          console.error(`Lote ${index}: formato desconhecido ${JSON.stringify(data).slice(0, 300)}`);
          return 'fail';
        }

        arr.forEach((item: any, idx: number) => {
          processItem(item, originalBatch[idx] || batch[idx]);
        });
        return 'ok';
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        const aborted = msg.includes('aborted') || msg.includes('abort');
        console.error(`Lote ${index} tentativa ${attempt + 1}: ${msg}`);
        return aborted ? 'retry' : 'fail';
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const processBatch = async (b: { batch: string[]; originalBatch: string[]; index: number }) => {
      let attempt = 0;
      while (attempt <= MAX_RETRIES) {
        const result = await tryFetchBatch(b, attempt);
        if (result === 'ok') return;
        if (result === 'fail') break;
        attempt++;
        if (attempt <= MAX_RETRIES) {
          // small backoff before retry
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
      console.error(`Lote ${b.index}: marcando ${b.originalBatch.length} números como erro após ${attempt} tentativas`);
      b.originalBatch.forEach((n: string) => errors.push(n));
    };

    // Process with limited concurrency
    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const slice = batches.slice(i, i + CONCURRENCY);
      await Promise.all(slice.map(processBatch));
    }

    console.log(`Resultado final: total=${numbers.length} valid=${valid.length} invalid=${invalid.length} errors=${errors.length}`);

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
