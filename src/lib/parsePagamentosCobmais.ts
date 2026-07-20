import * as XLSX from 'xlsx';

export interface LinhaPagamentoImportada {
  linha: number; // linha original da planilha (1-based, contando cabeçalho)
  cpf: string;   // apenas dígitos, com padding para 11
  cliente: string;
  contrato: string;
  parcela: number | null;
  valorPago: number;
  dataPagamento: string; // ISO YYYY-MM-DD
}

const onlyDigits = (s: any) => String(s ?? '').replace(/\D+/g, '');

function padCpf(d: string): string {
  if (!d) return '';
  // CPF tem 11 dígitos, CNPJ tem 14. Só faz pad se parecer CPF (<=11).
  if (d.length <= 11) return d.padStart(11, '0');
  return d;
}

function parseBRNumber(v: any): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/\s/g, '').replace(/R\$/gi, '');
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
  return Number(s) || 0;
}

function parseDateISO(v: any): string {
  if (v == null || v === '') return '';
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof v === 'number') {
    const dc = XLSX.SSF.parse_date_code(v);
    if (dc) return `${dc.y}-${String(dc.m).padStart(2, '0')}-${String(dc.d).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  // "20/07/2026 16:19:40" ou "20/07/2026"
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // ISO já formatado
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  return '';
}

function findCol(headers: any[], ...names: string[]): number {
  const norm = (s: any) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normed = headers.map((h) => norm(h));
  for (const n of names) {
    const idx = normed.indexOf(norm(n));
    if (idx >= 0) return idx;
  }
  return -1;
}

export async function parsePagamentosCobmais(file: File): Promise<LinhaPagamentoImportada[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === 'pagamentos');
  if (!sheetName) {
    throw new Error('Aba "Pagamentos" não encontrada na planilha.');
  }
  const sheet = wb.Sheets[sheetName];

  // Recalcula range varrendo chaves reais (Cob+ costuma quebrar o !ref).
  let maxR = 0, maxC = 0;
  for (const key of Object.keys(sheet)) {
    if (key[0] === '!') continue;
    const ref = XLSX.utils.decode_cell(key);
    if (ref.r > maxR) maxR = ref.r;
    if (ref.c > maxC) maxC = ref.c;
  }
  if (maxR > 0 || maxC > 0) {
    sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }) as any[][];
  if (rows.length < 2) return [];

  const headers = rows[0];
  const iCpf = findCol(headers, 'CPF/CNPJ', 'CPF');
  const iCliente = findCol(headers, 'CLIENTE', 'NOME');
  const iContrato = findCol(headers, 'CONTRATO');
  const iValor = findCol(headers, 'VALOR PAGO', 'VALOR');
  const iData = findCol(headers, 'DATA', 'DATA PAGAMENTO', 'DATA DE PAGAMENTO');
  const iParcela = findCol(headers, 'PARCELA', 'Nº PARCELA', 'NUMERO PARCELA');

  if (iCpf < 0 || iValor < 0 || iData < 0) {
    throw new Error('Colunas obrigatórias não encontradas em "Pagamentos" (esperado: CPF/CNPJ, VALOR PAGO, DATA).');
  }

  const out: LinhaPagamentoImportada[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const cpf = padCpf(onlyDigits(row[iCpf]));
    if (!cpf) continue;
    const valor = parseBRNumber(row[iValor]);
    const data = parseDateISO(row[iData]);
    if (!data) continue;
    const parcelaRaw = iParcela >= 0 ? String(row[iParcela] ?? '').trim() : '';
    const parcelaNum = parcelaRaw ? Number(parcelaRaw.replace(/\D+/g, '')) : NaN;
    out.push({
      linha: r + 1,
      cpf,
      cliente: iCliente >= 0 ? String(row[iCliente] ?? '').trim() : '',
      contrato: iContrato >= 0 ? String(row[iContrato] ?? '').trim() : '',
      parcela: Number.isFinite(parcelaNum) && parcelaNum > 0 ? parcelaNum : null,
      valorPago: valor,
      dataPagamento: data,
    });
  }
  return out;
}
