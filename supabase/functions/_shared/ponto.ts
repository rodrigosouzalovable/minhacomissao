// Helpers compartilhados do módulo de Ponto / Atividade
const TZ = "America/Sao_Paulo";

/** Data (YYYY-MM-DD) no fuso de Brasília */
export function dataBRT(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Hora HH:MM no fuso de Brasília */
export function horaBRT(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** Dia da semana no fuso BRT: 0=domingo … 6=sábado */
export function diaSemanaBRT(d: Date = new Date()): number {
  const s = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(d);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[s] ?? new Date().getDay();
}

/** Extrai o IP público do cliente a partir dos headers do proxy */
export function ipDoRequest(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const first = fwd.split(",")[0]?.trim();
  return (
    first ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    ""
  );
}

function ipv4ParaInt(ip: string): number | null {
  const partes = ip.split(".");
  if (partes.length !== 4) return null;
  let out = 0;
  for (const p of partes) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    out = (out << 8) + n;
  }
  return out >>> 0;
}

/** Compara IP com uma entrada que pode ser IP exato ou CIDR (IPv4). IPv6 => comparação exata. */
export function ipCombina(ip: string, entrada: string): boolean {
  const alvo = (ip || "").trim();
  const regra = (entrada || "").trim();
  if (!alvo || !regra) return false;
  if (regra === alvo) return true;

  if (regra.includes("/")) {
    const [base, bitsStr] = regra.split("/");
    const bits = Number(bitsStr);
    const a = ipv4ParaInt(alvo);
    const b = ipv4ParaInt(base);
    if (a === null || b === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
    if (bits === 0) return true;
    const mask = (0xffffffff << (32 - bits)) >>> 0;
    return (a & mask) === (b & mask);
  }
  return false;
}

export interface RegraIp {
  cidr: string;
  ativo: boolean;
}

export function ipAutorizado(ip: string, regras: RegraIp[]): boolean {
  return regras.some((r) => r.ativo && ipCombina(ip, r.cidr));
}

export const ORDEM_PONTO = ["entrada", "saida_almoco", "volta_almoco", "saida"] as const;
export type PontoTipo = typeof ORDEM_PONTO[number];

export const LABEL_PONTO: Record<PontoTipo, string> = {
  entrada: "Entrada",
  saida_almoco: "Saída para almoço",
  volta_almoco: "Volta do almoço",
  saida: "Saída",
};

/** Próximo tipo esperado dado os tipos já registrados no dia */
export function proximoTipo(jaRegistrados: string[]): PontoTipo | null {
  for (const t of ORDEM_PONTO) {
    if (!jaRegistrados.includes(t)) return t;
  }
  return null;
}
