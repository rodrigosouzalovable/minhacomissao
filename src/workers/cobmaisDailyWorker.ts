import * as XLSX from 'xlsx';

type StageRow = {
  source_key: string;
  cpf: string;
  nome: string;
  credor: string;
  contrato: string;
  numero_parcela: string;
  vencimento: string | null;
  valor: number;
  observacao: string | null;
  status: string | null;
};

const normalize = (value: unknown) => String(value ?? '').trim();
const digits = (value: unknown) => normalize(value).replace(/\D/g, '');
const dateValue = (value: unknown): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const match = normalize(value).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
};

let batches: StageRow[][] = [];
let nextBatch = 0;
let totalParcels = 0;

self.onmessage = (event: MessageEvent) => {
  if (event.data?.type === 'ack') {
    nextBatch += 1;
    if (nextBatch < batches.length) self.postMessage({ type: 'batch', rows: batches[nextBatch], index: nextBatch, total: batches.length });
    else {
      self.postMessage({ type: 'complete', totalParcels });
      batches = [];
      nextBatch = 0;
      totalParcels = 0;
    }
    return;
  }

  try {
    const workbook = XLSX.read(event.data.buffer, { type: 'array', dense: true, cellDates: true });
    const sheet = workbook.Sheets.Parcelas;
    if (!sheet) throw new Error('A aba Parcelas não foi encontrada.');
    const dense = sheet as XLSX.WorkSheet & Record<string, Array<{ v?: unknown }> | undefined>;
    const indexes = Object.keys(dense).filter((key) => /^\d+$/.test(key)).map(Number).sort((a, b) => a - b);
    const header = (dense[String(indexes[0])] ?? []).slice(0, 11).map((cell) => normalize(cell?.v).toUpperCase());
    const expected = ['CPF/CNPJ', 'CLIENTE', 'CREDOR', 'CONTRATO', 'INCLUSAO', 'ARQUIVO', 'NUMERO', 'VENCIMENTO', 'VALOR', 'OBSERVAÇÃO', 'STATUS'];
    if (expected.some((value, index) => header[index] !== value)) throw new Error('As colunas da aba Parcelas não correspondem à exportação diária do Cobmais.');

    const unique = new Map<string, StageRow>();
    let invalid = 0;
    let repeated = 0;
    let conflicts = 0;
    const started = Date.now();
    for (let position = 1; position < indexes.length; position += 1) {
      const cells = dense[String(indexes[position])] ?? [];
      const cpf = digits(cells[0]?.v);
      const nome = normalize(cells[1]?.v);
      const credor = normalize(cells[2]?.v);
      const contrato = normalize(cells[3]?.v);
      const numero = normalize(cells[6]?.v);
      if (!cpf || !nome || !credor || !contrato || !numero) {
        invalid += 1;
        continue;
      }
      const key = `${cpf}|${credor.toUpperCase()}|${contrato}|${numero}`;
      const row: StageRow = {
        source_key: key,
        cpf,
        nome,
        credor,
        contrato,
        numero_parcela: numero,
        vencimento: dateValue(cells[7]?.v),
        valor: Number(cells[8]?.v ?? 0) || 0,
        observacao: normalize(cells[9]?.v) || null,
        status: normalize(cells[10]?.v).toUpperCase() || null,
      };
      const previous = unique.get(key);
      if (previous) {
        repeated += 1;
        if (previous.vencimento !== row.vencimento || previous.valor !== row.valor || previous.status !== row.status) conflicts += 1;
      }
      unique.set(key, row);
      if (position % 10000 === 0) self.postMessage({ type: 'parsing', current: position, total: indexes.length - 1, started });
    }
    const rows = [...unique.values()];
    totalParcels = rows.length;
    batches = [];
    // Lotes maiores reduzem drasticamente as viagens ao servidor em arquivos
    // Cobmais com mais de meio milhão de parcelas, sem ultrapassar o tamanho
    // aceito pela API de dados.
    for (let index = 0; index < rows.length; index += 3000) batches.push(rows.slice(index, index + 3000));
    nextBatch = 0;
    self.postMessage({ type: 'summary', totalRows: indexes.length - 1, totalParcels: rows.length, repeated, conflicts, invalid });
    if (batches.length) self.postMessage({ type: 'batch', rows: batches[0], index: 0, total: batches.length });
    else self.postMessage({ type: 'complete', totalParcels });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Não foi possível ler a planilha.' });
  }
};