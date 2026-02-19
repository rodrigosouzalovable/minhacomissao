const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dataInicial, dataFinal, tipo } = await req.json();

    if (!dataInicial || !dataFinal || !tipo) {
      return new Response(JSON.stringify({ error: 'dataInicial, dataFinal e tipo são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate year range to avoid BCB API errors
    const yearInicial = parseInt(dataInicial.split('-')[0], 10);
    const yearFinal = parseInt(dataFinal.split('-')[0], 10);
    if (yearInicial < 1990 || yearInicial > 2100 || yearFinal < 1990 || yearFinal > 2100) {
      return new Response(JSON.stringify({ taxaAcumulada: 0, registros: 0, tipo, error: 'Datas fora do intervalo válido' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const diStr = formatDateBR(dataInicial);
    const dfStr = formatDateBR(dataFinal);

    // Série 11 = Selic diária, Série 188 = INPC mensal
    const serie = tipo === 'selic' ? '11' : '188';

    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados?formato=json&dataInicial=${diStr}&dataFinal=${dfStr}`;
    console.log('Fetching BCB:', url);

    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      console.error('BCB API error:', response.status, text);
      return new Response(JSON.stringify({ error: 'Erro ao consultar API do BCB', details: text }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return new Response(JSON.stringify({ taxaAcumulada: 0, registros: 0, tipo }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let taxaAcumulada: number;

    if (tipo === 'selic') {
      // Selic diária: acumular com produto (1 + taxa/100) - 1
      let fatorAcumulado = 1;
      for (const item of data) {
        const taxa = parseFloat(item.valor);
        fatorAcumulado *= (1 + taxa / 100);
      }
      taxaAcumulada = (fatorAcumulado - 1) * 100;
    } else {
      // INPC mensal: acumular com produto (1 + taxa/100) - 1
      let fatorAcumulado = 1;
      for (const item of data) {
        const taxa = parseFloat(item.valor);
        fatorAcumulado *= (1 + taxa / 100);
      }
      taxaAcumulada = (fatorAcumulado - 1) * 100;
    }

    return new Response(JSON.stringify({
      taxaAcumulada: Math.round(taxaAcumulada * 10000) / 10000,
      registros: data.length,
      tipo,
      periodo: { de: diStr, ate: dfStr },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
