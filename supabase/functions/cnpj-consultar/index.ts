import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');

function normalizarBrasilApi(j: any, cnpj: string) {
  const numero = j?.numero ? `, ${j.numero}` : '';
  return {
    cnpj,
    razao_social: j?.razao_social ?? j?.nome_fantasia ?? '',
    nome_fantasia: j?.nome_fantasia ?? '',
    endereco: [j?.descricao_tipo_de_logradouro, j?.logradouro].filter(Boolean).join(' ').trim() + numero,
    bairro: j?.bairro ?? '',
    cidade: j?.municipio ?? '',
    uf: j?.uf ?? '',
    cep: soDigitos(j?.cep),
    telefone: soDigitos(j?.ddd_telefone_1),
    email: j?.email ?? '',
    cnae: j?.cnae_fiscal_descricao ?? '',
    abertura: j?.data_inicio_atividade ?? '',
    situacao: j?.descricao_situacao_cadastral ?? '',
  };
}

function normalizarReceitaWs(j: any, cnpj: string) {
  return {
    cnpj,
    razao_social: j?.nome ?? '',
    nome_fantasia: j?.fantasia ?? '',
    endereco: [j?.logradouro, j?.numero].filter(Boolean).join(', '),
    bairro: j?.bairro ?? '',
    cidade: j?.municipio ?? '',
    uf: j?.uf ?? '',
    cep: soDigitos(j?.cep),
    telefone: soDigitos(String(j?.telefone ?? '').split('/')[0]),
    email: j?.email ?? '',
    cnae: j?.atividade_principal?.[0]?.text ?? '',
    abertura: j?.abertura ? String(j.abertura).split('/').reverse().join('-') : '',
    situacao: j?.situacao ?? '',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({}));
    const cnpj = soDigitos(body?.cnpj);
    if (cnpj.length !== 14) return json({ success: false, error: 'CNPJ inválido (informe 14 dígitos).' }, 400);

    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (res.ok) return json({ success: true, empresa: normalizarBrasilApi(await res.json(), cnpj), fonte: 'brasilapi' });
      if (res.status === 404) return json({ success: false, error: 'CNPJ não encontrado na Receita Federal.' }, 404);
      await res.text();
    } catch (e) {
      console.error('brasilapi falhou', e);
    }

    const res2 = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`);
    if (!res2.ok) return json({ success: false, error: 'Não foi possível consultar o CNPJ agora. Tente novamente.' }, 502);
    const j2 = await res2.json();
    if (j2?.status === 'ERROR') return json({ success: false, error: j2?.message || 'CNPJ não encontrado.' }, 404);
    return json({ success: true, empresa: normalizarReceitaWs(j2, cnpj), fonte: 'receitaws' });
  } catch (error: any) {
    console.error('cnpj-consultar erro', error);
    return json({ success: false, error: error?.message ?? 'Erro inesperado' }, 500);
  }
});
