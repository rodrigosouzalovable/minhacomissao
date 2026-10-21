// Leitura do arquivo posicional da UME/Odres (CSV ";" com tipo de registro na 1ª coluna).
// 00 = cabeçalho (data do lote, carteira), 01 = cliente (borrowerId+CPF), 06 = parcela em aberto (installmentId), 08 = pagamento direto, 22 = baixa de parcela de acordo.
export type BaixaSftp = {
  tipo: '08' | '22';
  cpf: string;
  contrato: string | null;
  parcela_ref: string | null;
  vencimento: string | null;
  valor: number | null;
  data_pagamento: string | null;
  valor_pago: number | null;
};

export type ClienteSftp = { cpf: string; borrower_id: string; nome: string | null };
// 06 = parcela em aberto: borrowerId;CPF;contrato;installmentId;vencimento;valor
export type ParcelaSftp = { installment_id: string; cpf: string; borrower_id: string; contrato: string | null; vencimento: string | null; valor: number | null };

export type ArquivoSftpLido = { dataLote: string | null; carteira: string | null; totalLinhas: number; baixas: BaixaSftp[]; clientes: ClienteSftp[]; parcelas: ParcelaSftp[] };

export function dataBR(v: string | undefined): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec((v ?? '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function num(v: string | undefined): number | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const txt = (v: string | undefined) => ((v ?? '').trim() || null);

export function lerArquivoSftp(conteudo: string): ArquivoSftpLido {
  let dataLote: string | null = null;
  let carteira: string | null = null;
  let totalLinhas = 0;
  const baixas: BaixaSftp[] = [];
  const clientes: ClienteSftp[] = [];
  const parcelas: ParcelaSftp[] = [];
  for (const bruta of conteudo.split(/\r?\n/)) {
    if (!bruta) continue;
    totalLinhas++;
    const p = bruta.split(';');
    const cpf = (p[2] ?? '').replace(/\D/g, '');
    if (p[0] === '00') { dataLote = dataBR(p[1]); carteira = txt(p[2]); }
    else if (p[0] === '01') {
      // 01 = cliente: borrowerId;tipo;CPF;nome
      const c = (p[3] ?? '').replace(/\D/g, '');
      const id = txt(p[1]);
      if (c && id) clientes.push({ cpf: c.padStart(11, '0'), borrower_id: id, nome: txt(p[4]) });
    } else if (p[0] === '06' && cpf && txt(p[4])) {
      parcelas.push({ installment_id: txt(p[4])!, cpf: cpf.padStart(11, '0'), borrower_id: txt(p[1]) ?? '',
        contrato: txt(p[3]), vencimento: dataBR(p[5]), valor: num(p[6]) });
    }
    else if (p[0] === '08' && cpf) {
      baixas.push({ tipo: '08', cpf, contrato: txt(p[7]), parcela_ref: txt(p[6]), vencimento: dataBR(p[4]),
        valor: num(p[5]), data_pagamento: dataBR(p[8]), valor_pago: num(p[9]) });
    } else if (p[0] === '22' && cpf) {
      baixas.push({ tipo: '22', cpf, contrato: txt(p[3]), parcela_ref: txt(p[5]), vencimento: dataBR(p[6]),
        valor: num(p[7]), data_pagamento: null, valor_pago: num(p[12]) ?? num(p[7]) });
    }
  }
  return { dataLote, carteira, totalLinhas, baixas, clientes, parcelas };
}
