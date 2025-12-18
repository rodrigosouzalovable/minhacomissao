// Tabela de comissões baseada em dias em atraso
export const tabelaComissoes = [
  { min: 1, max: 60, percentual: 2 },
  { min: 61, max: 90, percentual: 4 },
  { min: 91, max: 180, percentual: 5 },
  { min: 181, max: 360, percentual: 7 },
  { min: 361, max: 720, percentual: 9 },
  { min: 721, max: 9999, percentual: 13 }
];

export function calcularPercentualComissao(diasAtraso: number): number {
  for (const faixa of tabelaComissoes) {
    if (diasAtraso >= faixa.min && diasAtraso <= faixa.max) {
      return faixa.percentual;
    }
  }
  return 0;
}

export function calcularComissao(valorTotal: number, parcelas: number, diasAtraso: number) {
  const percentual = calcularPercentualComissao(diasAtraso);
  const valorParcela = valorTotal / parcelas;
  const comissaoPorParcela = valorParcela * (percentual / 100);
  const comissaoTotal = comissaoPorParcela * parcelas;

  return {
    percentual,
    valorParcela: Math.round(valorParcela * 100) / 100,
    comissaoPorParcela: Math.round(comissaoPorParcela * 100) / 100,
    comissaoTotal: Math.round(comissaoTotal * 100) / 100
  };
}

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

export function formatarData(data: string | Date | null | undefined): string {
  if (!data) return '-';
  
  let d: Date;
  if (typeof data === 'string') {
    // Se já contém 'T' (timestamp ISO), usa direto. Senão, adiciona T00:00:00
    d = data.includes('T') ? new Date(data) : new Date(data + 'T00:00:00');
  } else {
    d = data;
  }
  
  if (isNaN(d.getTime())) return '-';
  
  return new Intl.DateTimeFormat('pt-BR').format(d);
}

export function gerarParcelas(
  dataPrimeiroPagamento: Date,
  numeroParcelas: number,
  valorParcela: number,
  comissaoPorParcela: number,
  valorEntrada?: number,
  comissaoEntrada?: number
) {
  const parcelas = [];
  
  for (let i = 0; i < numeroParcelas; i++) {
    const dataPrevista = new Date(dataPrimeiroPagamento);
    dataPrevista.setMonth(dataPrevista.getMonth() + i);
    
    // Se é a primeira parcela e tem entrada definida, usa os valores de entrada
    const isEntrada = i === 0 && valorEntrada !== undefined;
    
    parcelas.push({
      numero_parcela: i + 1,
      data_prevista: dataPrevista.toISOString().split('T')[0],
      valor_parcela: isEntrada ? valorEntrada : valorParcela,
      comissao_parcela: isEntrada && comissaoEntrada !== undefined ? comissaoEntrada : comissaoPorParcela,
      status: 'pendente' as const
    });
  }
  
  return parcelas;
}
