// ============================================================
// Tabela de comissão do FUNCIONÁRIO (NÃO confundir com escritório)
// Esta é a única tabela que pode ser exibida para funcionários.
// Máximo 7% a partir de 721 dias.
// ============================================================
export const tabelaComissoesFuncionario = [
  { min: 1,   max: 90,    percentual: 2 },
  { min: 91,  max: 180,   percentual: 4 },
  { min: 181, max: 360,   percentual: 5 },
  { min: 361, max: 720,   percentual: 6 },
  { min: 721, max: 999999, percentual: 7 },
];

export function calcularPercentualComissaoFuncionario(diasAtraso: number): number {
  for (const faixa of tabelaComissoesFuncionario) {
    if (diasAtraso >= faixa.min && diasAtraso <= faixa.max) {
      return faixa.percentual;
    }
  }
  return 0;
}

export function calcularComissaoFuncionarioParcela(valorParcela: number, diasAtraso: number) {
  const percentual = calcularPercentualComissaoFuncionario(diasAtraso);
  return {
    percentual,
    valor: Math.round(Number(valorParcela) * (percentual / 100) * 100) / 100,
  };
}

// Tabela de comissões MONTREAL (H.O. / Encargos) baseada em dias de atraso
export const tabelaComissoesMontreal = [
  { min: 31, max: 60, percentual: 8 },
  { min: 61, max: 90, percentual: 15 },
  { min: 91, max: 180, percentual: 20 },
  { min: 181, max: 360, percentual: 25 },
  { min: 361, max: 720, percentual: 30 },
  { min: 721, max: 1800, percentual: 35 },
];

export function calcularPercentualComissaoMontreal(diasAtraso: number): number {
  for (const faixa of tabelaComissoesMontreal) {
    if (diasAtraso >= faixa.min && diasAtraso <= faixa.max) {
      return faixa.percentual;
    }
  }
  return 0;
}

export function calcularComissaoMontrealParcela(valorParcela: number, diasAtraso: number) {
  const percentual = calcularPercentualComissaoMontreal(diasAtraso);
  return {
    percentual,
    valor: Math.round(valorParcela * (percentual / 100) * 100) / 100,
  };
}

// Tabela de juros UME APORTE baseada em dias de atraso
export const tabelaJurosAporte = [
  { min: 1, max: 30, percentual: 7 },
  { min: 31, max: 90, percentual: 15 },
  { min: 91, max: 180, percentual: 20 },
  { min: 181, max: 365, percentual: 27 },
  { min: 366, max: 99999, percentual: 36 },
];

export function calcularPercentualJurosAporte(diasAtraso: number): number {
  for (const faixa of tabelaJurosAporte) {
    if (diasAtraso >= faixa.min && diasAtraso <= faixa.max) {
      return faixa.percentual;
    }
  }
  return 0;
}

// Calcula valor com juros para APORTE: retorna valor original + juros
export function calcularJurosAporte(valorParcela: number, diasAtraso: number): number {
  const percentual = calcularPercentualJurosAporte(diasAtraso);
  return Math.round(valorParcela * (1 + percentual / 100) * 100) / 100;
}

// UME | INADIMPLENTES (valor no banco: 'ume_novo_mundo')
// Comissão (Honorário/Encargo) por faixa de atraso — mesma tabela do APORTE.
export const tabelaComissoes = [
  { min: 1, max: 30, percentual: 7 },
  { min: 31, max: 60, percentual: 8 },
  { min: 61, max: 90, percentual: 15 },
  { min: 91, max: 120, percentual: 20 },
  { min: 121, max: 150, percentual: 20 },
  { min: 151, max: 180, percentual: 20 },
  { min: 181, max: 210, percentual: 27 },
  { min: 211, max: 240, percentual: 27 },
  { min: 241, max: 270, percentual: 27 },
  { min: 271, max: 300, percentual: 27 },
  { min: 301, max: 330, percentual: 27 },
  { min: 331, max: 360, percentual: 27 },
  { min: 361, max: 420, percentual: 36 },
  { min: 421, max: 480, percentual: 36 },
  { min: 481, max: 540, percentual: 36 },
  { min: 541, max: 600, percentual: 36 },
  { min: 601, max: 660, percentual: 36 },
  { min: 661, max: 720, percentual: 36 },
  { min: 721, max: 1800, percentual: 50 },
  { min: 1801, max: 999999, percentual: 50 }
];

// UME | APORTE (valor no banco: 'mundo_da_moda')
// Comissão (Honorário/Encargo) por faixa de atraso, aplicada em TODAS as parcelas.
export const tabelaComissoesMundoDaModa = [
  { min: 1, max: 30, percentual: 7 },
  { min: 31, max: 60, percentual: 8 },
  { min: 61, max: 90, percentual: 15 },
  { min: 91, max: 120, percentual: 20 },
  { min: 121, max: 150, percentual: 20 },
  { min: 151, max: 180, percentual: 20 },
  { min: 181, max: 210, percentual: 27 },
  { min: 211, max: 240, percentual: 27 },
  { min: 241, max: 270, percentual: 27 },
  { min: 271, max: 300, percentual: 27 },
  { min: 301, max: 330, percentual: 27 },
  { min: 331, max: 360, percentual: 27 },
  { min: 361, max: 420, percentual: 36 },
  { min: 421, max: 480, percentual: 36 },
  { min: 481, max: 540, percentual: 36 },
  { min: 541, max: 600, percentual: 36 },
  { min: 601, max: 660, percentual: 36 },
  { min: 661, max: 720, percentual: 36 },
  { min: 721, max: 1800, percentual: 50 },
  { min: 1801, max: 999999, percentual: 50 }
];

// Tabela de comissões da EMPRESA baseada em dias em atraso
export const tabelaComissoesEmpresa = [
  { min: 1, max: 30, percentual: 7 },
  { min: 31, max: 60, percentual: 8 },
  { min: 61, max: 90, percentual: 15 },
  { min: 91, max: 120, percentual: 20 },
  { min: 121, max: 150, percentual: 20 },
  { min: 151, max: 180, percentual: 20 },
  { min: 181, max: 210, percentual: 27 },
  { min: 211, max: 240, percentual: 27 },
  { min: 241, max: 270, percentual: 27 },
  { min: 271, max: 300, percentual: 27 },
  { min: 301, max: 330, percentual: 27 },
  { min: 331, max: 360, percentual: 27 },
  { min: 361, max: 420, percentual: 36 },
  { min: 421, max: 480, percentual: 36 },
  { min: 481, max: 540, percentual: 36 },
  { min: 541, max: 600, percentual: 36 },
  { min: 601, max: 660, percentual: 36 },
  { min: 661, max: 720, percentual: 36 },
  { min: 721, max: 1800, percentual: 50 },
  { min: 1801, max: 99999, percentual: 50 }
];

export function calcularPercentualComissaoEmpresa(diasAtraso: number): number {
  for (const faixa of tabelaComissoesEmpresa) {
    if (diasAtraso >= faixa.min && diasAtraso <= faixa.max) {
      return faixa.percentual;
    }
  }
  return 0;
}

export function calcularPercentualComissao(diasAtraso: number): number {
  for (const faixa of tabelaComissoes) {
    if (diasAtraso >= faixa.min && diasAtraso <= faixa.max) {
      return faixa.percentual;
    }
  }
  return 0;
}

export function calcularPercentualComissaoMundoDaModa(diasAtraso: number): number {
  for (const faixa of tabelaComissoesMundoDaModa) {
    if (diasAtraso >= faixa.min && diasAtraso <= faixa.max) {
      return faixa.percentual;
    }
  }
  return 0;
}

// UME | APORTE: comissão (Honorário) aplicada em TODAS as parcelas, conforme faixa de atraso.
export function calcularComissaoMundoDaModa(valorTotal: number, parcelas: number, diasAtraso: number) {
  const percentual = calcularPercentualComissaoMundoDaModa(diasAtraso);
  const valorParcela = valorTotal / parcelas;
  const comissaoPorParcela = valorParcela * (percentual / 100);
  const comissaoTotal = comissaoPorParcela * parcelas;

  return {
    percentual,
    valorParcela: Math.round(valorParcela * 100) / 100,
    comissaoPrimeiraParcela: Math.round(comissaoPorParcela * 100) / 100,
    comissaoTotal: Math.round(comissaoTotal * 100) / 100
  };
}

// Gera parcelas para UME | APORTE (comissão em todas as parcelas).
export function gerarParcelasMundoDaModa(
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

// Função unificada: dada a empresa do acordo, calcula a comissão de UMA parcela paga.
// Usada principalmente no recálculo do Excel "Acordos da Equipe" para admins.
export function calcularComissaoParcelaPorEmpresa(
  empresa: string | null | undefined,
  valorParcela: number,
  diasAtraso: number
): { percentual: number; valor: number } {
  // Unificado: toda empresa usa a tabela faixada de Honorário (imagem UME).
  const percentual = calcularPercentualComissaoMundoDaModa(diasAtraso);
  const valor = Math.round(valorParcela * (percentual / 100) * 100) / 100;
  return { percentual, valor };
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
