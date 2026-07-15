// Extrai valor pago (USD), número de referência e data da transação
// de um PDF de fatura da Meta (WhatsApp Business). NÃO persiste o PDF.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
// @ts-ignore - deno esm
import { getDocument } from 'https://esm.sh/pdfjs-serverless@0.5.0';

const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

function parseDataPt(raw: string): string | null {
  // "9 de jul de 2026" -> "2026-07-09"
  const m = raw.toLowerCase().match(/(\d{1,2})\s+de\s+([a-zç]{3,})\.?\s+de\s+(\d{4})/i);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = MESES[m[2].slice(0, 3)];
  const ano = Number(m[3]);
  if (!mes) return null;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

async function extractText(base64: string): Promise<string> {
  const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const doc = await getDocument({ data: bin, useSystemFonts: true }).promise;
  let out = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    out += content.items.map((it: any) => it.str).join('\n') + '\n';
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { pdf_base64 } = await req.json();
    if (!pdf_base64 || typeof pdf_base64 !== 'string') {
      return new Response(JSON.stringify({ success: false, error: 'pdf_base64 obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const texto = await extractText(pdf_base64);

    // Número de referência: "Número de referência: AX3HGVZLU2"
    const refMatch = texto.match(/N[úu]mero de refer[êe]ncia\s*:?\s*([A-Z0-9]{6,})/i);
    const numero_referencia = refMatch ? refMatch[1].trim() : null;

    // Valor: "US$1,22" ou "US$ 1.234,56"
    const valorMatch = texto.match(/US\$\s*([\d.,]+)/);
    let valor_usd: number | null = null;
    if (valorMatch) {
      // pt-BR: "1.234,56" -> "1234.56"
      const raw = valorMatch[1].replace(/\./g, '').replace(',', '.');
      const n = Number(raw);
      if (!isNaN(n)) valor_usd = n;
    }

    // Data: "9 de jul de 2026"
    const dataMatch = texto.match(/\d{1,2}\s+de\s+[a-zç]{3,}\.?\s+de\s+\d{4}/i);
    const data_transacao = dataMatch ? parseDataPt(dataMatch[0]) : null;

    return new Response(
      JSON.stringify({
        success: true,
        valor_usd,
        numero_referencia,
        data_transacao,
        preview_texto: texto.slice(0, 500),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'erro' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
