import * as XLSX from 'xlsx';

export interface ParcelaAberta {
  numero: string;
  vencimento: string;
  valor: number;
}

export interface ClienteImportado {
  cpf: string;
  nome: string;
  contrato: string;
  telefone: string; // primeiro telefone (compat)
  telefones: string[]; // todos os telefones marcados como "Sim"
  totalAtraso: number;
  diasAtraso: number;
  parcelas: ParcelaAberta[];
}

const onlyDigits = (s: any) => String(s ?? '').replace(/\D+/g, '');

const norm = (s: any) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

function findCol(headers: any[], ...names: string[]): number {
  const normed = headers.map((h) => norm(h));
  for (const n of names) {
    const idx = normed.indexOf(norm(n));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseBRNumber(v: any): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/\s/g, '').replace(/R\$/gi, '');
  // "3850,00" or "3.850,00" or "3850.00"
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
  return Number(s) || 0;
}

function parseDateCell(v: any): string {
  if (v == null || v === '') return '';
  if (v instanceof Date) {
    const d = v;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
  if (typeof v === 'number') {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(v);
    if (date) return `${String(date.d).padStart(2, '0')}/${String(date.m).padStart(2, '0')}/${date.y}`;
  }
  const s = String(v).trim();
  // "15/11/2023 00:00:00" -> "15/11/2023"
  const m = s.match(/^(\d{2}\/\d{2}\/\d{4})/);
  return m ? m[1] : s;
}

function sheetToRows(wb: XLSX.WorkBook, name: string): any[][] {
  const sheet = wb.Sheets[name];
  if (!sheet) return [];
  // Cob+ exporta `!ref` apontando só para a linha do cabeçalho.
  // Recalcula a range varrendo as chaves reais de célula.
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
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }) as any[][];
}

function normalizePhone(p: string): string {
  const d = onlyDigits(p);
  if (!d) return '';
  if (d.startsWith('55') && d.length >= 12) return d;
  if (d.length === 10 || d.length === 11) return '55' + d;
  return d;
}

export async function parsePlanilhaCobmais(file: File): Promise<ClienteImportado[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });

  // ----- Cobrança -----
  const cobRows = sheetToRows(wb, 'Cobrança');
  if (cobRows.length < 2) throw new Error('Aba "Cobrança" vazia ou inexistente.');
  const cobH = cobRows[0];
  const ciCpf = findCol(cobH, 'CPF/CNPJ', 'CPF');
  const ciNome = findCol(cobH, 'CLIENTE', 'NOME');
  const ciContrato = findCol(cobH, 'CONTRATO');
  const ciTotal = findCol(cobH, 'TOTAL ATRASO', 'TOTAL EM ATRASO', 'TOTAL');
  let ciDias = findCol(cobH, 'DIAS EM ATRASO', 'DIAS ATRASO', 'DIAS');
  if (ciDias < 0) ciDias = 5; // fallback: coluna F
  if (ciCpf < 0 || ciNome < 0 || ciContrato < 0 || ciTotal < 0) {
    throw new Error('Cabeçalhos de "Cobrança" não encontrados (esperado: CPF/CNPJ, CLIENTE, CONTRATO, TOTAL ATRASO).');
  }

  const clientes = new Map<string, ClienteImportado>();
  for (let r = 1; r < cobRows.length; r++) {
    const row = cobRows[r];
    const cpf = onlyDigits(row[ciCpf]);
    if (!cpf) continue;
    if (clientes.has(cpf)) continue; // primeira ocorrência
    clientes.set(cpf, {
      cpf,
      nome: String(row[ciNome] ?? '').trim(),
      contrato: String(row[ciContrato] ?? '').trim(),
      telefone: '',
      telefones: [],
      totalAtraso: parseBRNumber(row[ciTotal]),
      diasAtraso: Math.max(0, Math.floor(Number(String(row[ciDias] ?? '').replace(/\D+/g, '')) || 0)),
      parcelas: [],
    });
  }

  // ----- Telefones -----
  const telRows = sheetToRows(wb, 'Telefones');
  if (telRows.length >= 2) {
    const h = telRows[0];
    const tiCpf = findCol(h, 'CPF/CNPJ', 'CPF');
    const tiNum = findCol(h, 'NUMERO', 'NÚMERO', 'TELEFONE');
    const tiContato = findCol(h, 'CONTATO');
    if (tiCpf >= 0 && tiNum >= 0) {
      for (let r = 1; r < telRows.length; r++) {
        const row = telRows[r];
        const cpf = onlyDigits(row[tiCpf]);
        if (!cpf) continue;
        const cli = clientes.get(cpf);
        if (!cli) continue;
        const isContato = tiContato >= 0 ? norm(row[tiContato]) === 'sim' : true;
        if (!isContato) continue;
        const phone = normalizePhone(String(row[tiNum] ?? ''));
        if (!phone) continue;
        if (cli.telefones.includes(phone)) continue;
        cli.telefones.push(phone);
        if (!cli.telefone) cli.telefone = phone;
      }
    }
  }

  // ----- Parcelas -----
  const parcRows = sheetToRows(wb, 'Parcelas');
  if (parcRows.length >= 2) {
    const h = parcRows[0];
    const piCpf = findCol(h, 'CPF/CNPJ', 'CPF');
    const piNum = findCol(h, 'NUMERO', 'PARCELA', 'Nº');
    const piVenc = findCol(h, 'VENCIMENTO', 'VCTO');
    const piValor = findCol(h, 'VALOR');
    if (piCpf >= 0 && piValor >= 0) {
      for (let r = 1; r < parcRows.length; r++) {
        const row = parcRows[r];
        const cpf = onlyDigits(row[piCpf]);
        const cli = clientes.get(cpf);
        if (!cli) continue;
        cli.parcelas.push({
          numero: String(row[piNum] ?? '').trim() || String(cli.parcelas.length + 1).padStart(2, '0'),
          vencimento: piVenc >= 0 ? parseDateCell(row[piVenc]) : '',
          valor: parseBRNumber(row[piValor]),
        });
      }
    }
  }

  return Array.from(clientes.values());
}

// ===================== Render template =====================

export interface RenderCtx {
  cliente: ClienteImportado;
  descontoVistaPct: number;
  parceladoQtd: number;
  descontoParceladoPct: number;
}

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function titleCaseFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function buildOpcoesParcelado(total: number, descPct: number): string {
  const valorTotal = total * (1 - (descPct || 0) / 100);
  const candidatos = [4, 8, 12, 15];
  const escolhidos = candidatos.filter((n) => n >= 2 && valorTotal / n >= 100);
  if (escolhidos.length === 0) return '';
  return escolhidos
    .map((n) => {
      const parcela = valorTotal / n;
      return `✅ *PARCELADO* em ${n}x de ${fmtBRL(parcela)}\n   (total R$ ${fmtBRL(valorTotal)}, ${descPct}% de desconto)`;
    })
    .join('\n\n');
}

export function renderMensagem(tpl: string, ctx: RenderCtx): string {
  const { cliente, descontoVistaPct, parceladoQtd, descontoParceladoPct } = ctx;
  const total = cliente.totalAtraso || 0;
  const qtdAberto = cliente.parcelas.length || 1;
  const valorParcelaAberto = total / qtdAberto;
  const valorQuitacao = total * (1 - descontoVistaPct / 100);
  const valorParceladoTotal = total * (1 - descontoParceladoPct / 100);
  const valorCadaParcelaProposta = parceladoQtd > 0 ? valorParceladoTotal / parceladoQtd : 0;
  const valorParcelaAlias = parceladoQtd > 0 ? valorParceladoTotal / parceladoQtd : 0;

  const lista = cliente.parcelas
    .map((p) => `• Parcela ${p.numero} — venc. ${p.vencimento} — R$ ${fmtBRL(p.valor)}`)
    .join('\n');

  const primeiroNomeRaw = (cliente.nome || '').trim().split(/\s+/)[0] || cliente.nome || '';

  const map: Record<string, string> = {
    '{nome}': cliente.nome,
    '{primeiro_nome}': titleCaseFirst(primeiroNomeRaw),
    '{cpf}': cliente.cpf,
    '{contrato}': cliente.contrato,
    '{telefone}': cliente.telefone,
    '{total_atraso}': fmtBRL(total),
    '{dias_atraso}': String(cliente.diasAtraso ?? 0),
    '{qtd_parcelas_atraso}': String(cliente.parcelas.length),
    '{valor_parcela_aberto}': fmtBRL(valorParcelaAberto),
    '{lista_parcelas}': lista,
    '{desconto_vista_pct}': String(descontoVistaPct),
    '{desconto_pct}': String(descontoVistaPct),
    '{valor_quitacao}': fmtBRL(valorQuitacao),
    '{parcelado_qtd}': String(parceladoQtd),
    '{parcelas_qtd}': String(parceladoQtd),
    '{desconto_parcelado_pct}': String(descontoParceladoPct),
    '{valor_cada_parcela_proposta}': fmtBRL(valorCadaParcelaProposta),
    '{valor_parcela}': fmtBRL(valorParcelaAlias),
    '{valor_parcelado_total}': fmtBRL(valorParceladoTotal),
    '{opcoes_parcelado}': buildOpcoesParcelado(total, descontoParceladoPct),
    '{data_hoje}': new Date().toLocaleDateString('pt-BR'),
  };

  return tpl.replace(/\{[a-z_]+\}/g, (m) => map[m] ?? m);
}
