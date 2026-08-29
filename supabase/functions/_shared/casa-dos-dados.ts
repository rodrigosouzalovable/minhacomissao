// Cliente da API da Casa dos Dados (v2 public search) para o módulo Certificado Digital.

const BASE = "https://api.casadosdados.com.br/v2/public/cnpj/search";

export interface CasaFiltro {
  ufs: string[];
  cnaes: string[];
  dataInicio: string; // yyyy-mm-dd
  dataFim: string; // yyyy-mm-dd
  somenteMei?: boolean;
  somenteCelular?: boolean;
  pagina?: number;
  limite?: number;
}

export interface LeadBruto {
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  telefones: string[];
  email: string | null;
  cnae: string | null;
  cnae_descricao: string | null;
  uf: string | null;
  municipio: string | null;
  porte: string | null;
  mei: boolean | null;
  data_abertura: string | null;
}

function apenasDigitos(v: unknown) {
  return String(v ?? "").replace(/\D/g, "");
}

/** Normaliza para o padrão 55 + DDD + número (celular ganha o nono dígito). */
export function normalizarTelefone(raw: string): string | null {
  let d = apenasDigitos(raw);
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  if (d.length === 10) {
    const ddd = d.slice(0, 2);
    const resto = d.slice(2);
    // Fixo (começa com 2..5) fica como está; móvel antigo (6..9) recebe o 9.
    if (/^[6-9]/.test(resto)) d = `${ddd}9${resto}`;
  }
  if (d.length !== 10 && d.length !== 11) return null;
  return `55${d}`;
}

export function ehCelular(telefone55: string): boolean {
  const d = apenasDigitos(telefone55).replace(/^55/, "");
  return d.length === 11 && d[2] === "9";
}

function extrairTelefones(item: Record<string, any>): string[] {
  const brutos: string[] = [];
  const push = (v: unknown) => {
    const s = String(v ?? "").trim();
    if (s) brutos.push(s);
  };

  if (Array.isArray(item.telefones)) {
    for (const t of item.telefones) {
      if (typeof t === "string") push(t);
      else if (t && typeof t === "object") push(`${t.ddd ?? ""}${t.numero ?? t.telefone ?? ""}`);
    }
  }
  push(item.telefone);
  push(item.telefone_1);
  push(item.telefone_2);
  if (item.ddd_telefone_1) push(item.ddd_telefone_1);
  if (item.ddd_telefone_2) push(item.ddd_telefone_2);
  if (item.ddd1 && item.telefone1) push(`${item.ddd1}${item.telefone1}`);
  if (item.ddd2 && item.telefone2) push(`${item.ddd2}${item.telefone2}`);

  const normalizados = brutos
    .map((b) => normalizarTelefone(b))
    .filter((t): t is string => !!t);
  return [...new Set(normalizados)];
}

function mapear(item: Record<string, any>): LeadBruto | null {
  const cnpj = apenasDigitos(item.cnpj ?? item.cnpj_raiz ?? item.numero_cnpj);
  if (cnpj.length !== 14) return null;

  const cnaeObj = item.cnae_fiscal ?? item.atividade_principal ?? item.cnae_principal;
  let cnae: string | null = null;
  let cnaeDesc: string | null = null;
  if (typeof cnaeObj === "string" || typeof cnaeObj === "number") {
    cnae = apenasDigitos(cnaeObj) || null;
  } else if (Array.isArray(cnaeObj) && cnaeObj[0]) {
    cnae = apenasDigitos(cnaeObj[0].code ?? cnaeObj[0].codigo) || null;
    cnaeDesc = cnaeObj[0].text ?? cnaeObj[0].descricao ?? null;
  } else if (cnaeObj && typeof cnaeObj === "object") {
    cnae = apenasDigitos((cnaeObj as any).codigo ?? (cnaeObj as any).code) || null;
    cnaeDesc = (cnaeObj as any).descricao ?? (cnaeObj as any).text ?? null;
  }
  cnaeDesc = cnaeDesc ?? item.cnae_fiscal_descricao ?? item.atividade_principal_descricao ?? null;

  const porte = item.porte ?? item.porte_empresa ?? null;
  const meiRaw = item.mei ?? item.opcao_pelo_mei ?? item.simei ?? null;

  return {
    cnpj,
    razao_social: item.razao_social ?? item.nome ?? null,
    nome_fantasia: item.nome_fantasia ?? item.fantasia ?? null,
    telefones: extrairTelefones(item),
    email: (item.email ?? null) || null,
    cnae,
    cnae_descricao: cnaeDesc,
    uf: item.uf ?? item.estado ?? null,
    municipio: item.municipio ?? item.cidade ?? null,
    porte: porte ? String(porte) : null,
    mei: typeof meiRaw === "boolean" ? meiRaw : meiRaw === "SIM" ? true : meiRaw === "NAO" ? false : null,
    data_abertura: item.data_abertura ?? item.data_inicio_atividade ?? null,
  };
}

export async function buscarCasaDosDados(filtro: CasaFiltro): Promise<{
  leads: LeadBruto[];
  total: number;
  raw?: unknown;
}> {
  const apiKey = Deno.env.get("CASA_DOS_DADOS_API_KEY");
  if (!apiKey) throw new Error("CASA_DOS_DADOS_API_KEY não configurada");

  const body = {
    query: {
      termo: [] as string[],
      atividade_principal: filtro.cnaes,
      natureza_juridica: [] as string[],
      uf: filtro.ufs,
      municipio: [] as string[],
      bairro: [] as string[],
      situacao_cadastral: "ATIVA",
      cep: [] as string[],
      ddd: [] as string[],
    },
    range_query: {
      data_abertura: { lte: filtro.dataFim, gte: filtro.dataInicio },
    },
    extras: {
      somente_mei: !!filtro.somenteMei,
      excluir_mei: false,
      com_email: false,
      incluir_atividade_secundaria: false,
      com_contato_telefonico: true,
      somente_fixo: false,
      somente_celular: !!filtro.somenteCelular,
      somente_matriz: false,
      somente_filial: false,
    },
    page: filtro.pagina ?? 1,
    limit: Math.min(filtro.limite ?? 100, 1000),
  };

  const resp = await fetch(BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const texto = await resp.text();
  if (!resp.ok) {
    throw new Error(`Casa dos Dados ${resp.status}: ${texto.slice(0, 400)}`);
  }

  let json: any;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new Error(`Resposta inválida da Casa dos Dados: ${texto.slice(0, 200)}`);
  }

  const lista: any[] = json?.data?.cnpj ?? json?.data ?? json?.cnpj ?? json?.result ?? [];
  const total = Number(json?.data?.count ?? json?.count ?? json?.total ?? lista.length) || lista.length;

  const leads = (Array.isArray(lista) ? lista : [])
    .map(mapear)
    .filter((l): l is LeadBruto => !!l);

  return { leads, total };
}
