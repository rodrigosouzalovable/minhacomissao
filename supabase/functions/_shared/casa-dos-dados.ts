// Cliente da API oficial v5 da Casa dos Dados para o módulo Certificado Digital.

const BASE = "https://api.casadosdados.com.br/v5/cnpj/pesquisa?tipo_resultado=completo";
const SALDO = "https://api.casadosdados.com.br/v5/saldo";
const MAX_TENTATIVAS = 3;
const TIMEOUT_MS = 30_000;

export class CasaDosDadosError extends Error {
  status: number | null;
  temporario: boolean;

  constructor(message: string, status: number | null, temporario: boolean) {
    super(message);
    this.name = "CasaDosDadosError";
    this.status = status;
    this.temporario = temporario;
  }
}

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

function bytesParaBase64(bytes: Uint8Array) {
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario);
}

function base64ParaBytes(valor: string) {
  const binario = atob(valor);
  return Uint8Array.from(binario, (char) => char.charCodeAt(0));
}

async function chaveCriptografica() {
  const segredo = Deno.env.get("CASA_DADOS_ENCRYPTION_KEY");
  if (!segredo) throw new Error("Proteção da chave da Casa dos Dados não configurada");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(segredo));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function cifrarChaveCasaDosDados(chave: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrada = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await chaveCriptografica(),
    new TextEncoder().encode(chave),
  );
  return { chaveCifrada: bytesParaBase64(new Uint8Array(cifrada)), iv: bytesParaBase64(iv) };
}

export async function resolverChaveCasaDosDados(service: any): Promise<string> {
  const { data, error } = await service
    .from("certificado_casa_dados_credencial")
    .select("chave_cifrada,iv")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error("Não foi possível acessar a chave da Casa dos Dados");
  if (!data) {
    const fallback = Deno.env.get("CASA_DOS_DADOS_API_KEY");
    if (!fallback) throw new Error("Cadastre a chave API da Casa dos Dados no início da aba Coleta");
    return fallback;
  }
  try {
    const aberta = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ParaBytes(data.iv) },
      await chaveCriptografica(),
      base64ParaBytes(data.chave_cifrada),
    );
    return new TextDecoder().decode(aberta);
  } catch {
    throw new Error("A chave cadastrada da Casa dos Dados não pôde ser lida. Cadastre-a novamente.");
  }
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
  if (Array.isArray(item.contatos?.telefones)) {
    for (const t of item.contatos.telefones) {
      if (typeof t === "string") push(t);
      else if (t && typeof t === "object") push(`${t.ddd ?? ""}${t.numero ?? t.telefone ?? ""}`);
    }
  }
  if (Array.isArray(item.telefones_comerciais)) {
    for (const t of item.telefones_comerciais) {
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

  const cnaeObj = item.cnae_fiscal ?? item.atividade_principal ?? item.cnae_principal ?? item.codigo_atividade_principal;
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

  const porteObj = item.porte ?? item.porte_empresa ?? null;
  const porte = typeof porteObj === "object" ? porteObj?.descricao ?? porteObj?.codigo ?? null : porteObj;
  const meiRaw = item.mei?.optante ?? item.mei ?? item.opcao_pelo_mei ?? item.simei ?? null;
  const endereco = item.endereco ?? {};
  const emails = item.emails ?? item.contatos?.emails;
  const email = item.email ?? (Array.isArray(emails) ? emails[0]?.email ?? emails[0] : null);

  return {
    cnpj,
    razao_social: item.razao_social ?? item.nome ?? null,
    nome_fantasia: item.nome_fantasia ?? item.fantasia ?? null,
    telefones: extrairTelefones(item),
    email: email ? String(email) : null,
    cnae,
    cnae_descricao: cnaeDesc,
    uf: item.uf ?? item.estado ?? endereco.uf ?? null,
    municipio: item.municipio ?? item.cidade ?? endereco.municipio ?? null,
    porte: porte ? String(porte) : null,
    mei: typeof meiRaw === "boolean" ? meiRaw : meiRaw === "SIM" ? true : meiRaw === "NAO" ? false : null,
    data_abertura: item.data_abertura ?? item.data_inicio_atividade ?? null,
  };
}

function mensagemErro(status: number) {
  if (status === 401) return "A chave da Casa dos Dados é inválida ou foi revogada. Cadastre uma chave válida.";
  if (status === 403) return "A chave foi reconhecida, mas não possui saldo ou acesso à pesquisa avançada da Casa dos Dados.";
  if (status === 400 || status === 422) return "A Casa dos Dados rejeitou os filtros da consulta. Revise a configuração da coleta.";
  if (status === 408) return "A Casa dos Dados demorou para responder. Tente novamente em alguns minutos.";
  if (status === 429) return "O limite de consultas da Casa dos Dados foi atingido. Aguarde a liberação do acesso.";
  return "A Casa dos Dados está temporariamente indisponível. Tente novamente em alguns minutos.";
}

async function requisitar(url: string, apiKey: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", "api-key": apiKey, ...(init.headers ?? {}) },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/** Confirma autenticação e informa o saldo sem consumir uma pesquisa avançada. */
export async function validarChaveCasaDosDados(apiKey: string): Promise<{ saldoTotal: number | null }> {
  try {
    const resp = await requisitar(SALDO, apiKey, { method: "GET" });
    if (!resp.ok) {
      const temporario = resp.status === 408 || resp.status === 429 || resp.status >= 500;
      throw new CasaDosDadosError(mensagemErro(resp.status), resp.status, temporario);
    }
    const payload = await resp.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      throw new CasaDosDadosError("A Casa dos Dados retornou uma resposta inválida ao validar a chave.", null, true);
    }
    const saldo = Number((payload as Record<string, unknown>).saldo_total);
    return { saldoTotal: Number.isFinite(saldo) ? saldo : null };
  } catch (error) {
    if (error instanceof CasaDosDadosError) throw error;
    throw new CasaDosDadosError("Não foi possível validar a chave na Casa dos Dados.", null, true);
  }
}

export async function buscarCasaDosDados(filtro: CasaFiltro, chaveInformada?: string): Promise<{
  leads: LeadBruto[];
  total: number;
  raw?: unknown;
}> {
  const apiKey = chaveInformada ?? Deno.env.get("CASA_DOS_DADOS_API_KEY");
  if (!apiKey) throw new Error("Chave API da Casa dos Dados não configurada");

  const body = {
    codigo_atividade_principal: filtro.cnaes,
    incluir_atividade_secundaria: false,
    situacao_cadastral: ["ATIVA"],
    uf: filtro.ufs.map((uf) => uf.toLowerCase()),
    data_abertura: { inicio: filtro.dataInicio, fim: filtro.dataFim },
    ...(filtro.somenteMei ? { mei: { optante: true, excluir_optante: false } } : {}),
    mais_filtros: {
      com_telefone: true,
      somente_fixo: false,
      somente_celular: !!filtro.somenteCelular,
      somente_matriz: false,
      somente_filial: false,
    },
    pagina: filtro.pagina ?? 1,
    limite: Math.min(filtro.limite ?? 100, 1000),
  };

  let texto = "";
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const resp = await fetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": apiKey },
        body: JSON.stringify(body), signal: controller.signal,
      });
      texto = await resp.text();
      if (resp.ok) break;

      const temporario = resp.status === 408 || resp.status === 429 || resp.status >= 500;
      if (!temporario || tentativa === MAX_TENTATIVAS) {
        throw new CasaDosDadosError(
          mensagemErro(resp.status),
          resp.status,
          temporario,
        );
      }
    } catch (error) {
      if (error instanceof CasaDosDadosError) throw error;
      if (tentativa === MAX_TENTATIVAS) {
        throw new CasaDosDadosError(
          "Não foi possível conectar à Casa dos Dados após novas tentativas.",
          null,
          true,
        );
      }
    } finally {
      clearTimeout(timeout);
    }
    await esperar(tentativa === 1 ? 1_000 : 2_500);
  }

  let json: any;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new CasaDosDadosError("A Casa dos Dados retornou uma resposta inválida.", null, true);
  }

  const lista: any[] = json?.cnpjs ?? json?.data?.cnpjs ?? json?.data?.cnpj ?? json?.data ?? json?.cnpj ?? json?.result ?? [];
  const total = Number(json?.total ?? json?.data?.total ?? json?.data?.count ?? json?.count ?? lista.length) || lista.length;

  const leads = (Array.isArray(lista) ? lista : [])
    .map(mapear)
    .filter((l): l is LeadBruto => !!l);

  return { leads, total };
}
