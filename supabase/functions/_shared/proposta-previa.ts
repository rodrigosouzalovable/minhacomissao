export interface PropostaPrevia {
  texto: string;
  valorAvista: string;
  valorAvistaNumero: number;
  parcelas: Array<{
    quantidade: number;
    valor: string;
    valorNumero: number;
    totalNumero: number;
  }>;
}

const moedaParaNumero = (valor: string): number =>
  Number(valor.replace(/\./g, '').replace(',', '.'));

/**
 * Extrai somente propostas explícitas. Um valor solto não é suficiente para
 * substituir o cálculo financeiro, evitando interpretar saldo ou dívida como oferta.
 */
export function extrairPropostaDoTexto(textoOriginal: unknown): PropostaPrevia | null {
  const texto = String(textoOriginal || '').trim();
  if (!texto) return null;

  const avista = texto.match(/(?:à\s*vista|a\s*vista|avista)[^\dR$]{0,45}(?:no\s+valor\s+de\s+)?R\$\s*([\d.]+,\d{2})/i)
    || texto.match(/R\$\s*([\d.]+,\d{2})[^\n.]{0,45}(?:à\s*vista|a\s*vista|avista)/i);

  const parcelas: PropostaPrevia['parcelas'] = [];
  const regexParcelas = /(\d{1,2})\s*x\s*(?:de\s*)?R\$\s*([\d.]+,\d{2})/gi;
  for (const match of texto.matchAll(regexParcelas)) {
    const quantidade = Number(match[1]);
    const valorNumero = moedaParaNumero(match[2]);
    if (quantidade >= 2 && quantidade <= 24 && Number.isFinite(valorNumero) && valorNumero > 0) {
      parcelas.push({
        quantidade,
        valor: match[2],
        valorNumero,
        totalNumero: quantidade * valorNumero,
      });
    }
  }

  if (!avista && !parcelas.length) return null;
  const valorAvista = avista?.[1] || '';
  const valorAvistaNumero = valorAvista ? moedaParaNumero(valorAvista) : 0;
  if (avista && (!Number.isFinite(valorAvistaNumero) || valorAvistaNumero <= 0)) return null;

  return { texto, valorAvista, valorAvistaNumero, parcelas };
}

export function detectarPropostaPreviaNoHistorico(historico: any[]): PropostaPrevia | null {
  const saidas = historico.filter((mensagem) => mensagem?.direcao === 'saida');
  for (let indice = saidas.length - 1; indice >= 0; indice--) {
    const proposta = extrairPropostaDoTexto(saidas[indice]?.conteudo);
    if (proposta) return proposta;
  }
  return null;
}