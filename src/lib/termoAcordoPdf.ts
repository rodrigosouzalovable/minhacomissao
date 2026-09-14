import type { Tables } from '@/integrations/supabase/types';
import souzaRibeiroAsset from '@/assets/souza-e-ribeiro-oficial.png.asset.json';
import umeAsset from '@/assets/ume-oficial.png.asset.json';
import novoMundoAsset from '@/assets/novo-mundo-oficial.png.asset.json';
import { getEmpresaLabel } from '@/lib/empresaLabels';

type Acordo = Tables<'acordos'>;
type Pagamento = Tables<'pagamentos'>;

export interface GerarTermoAcordoOptions {
  acordo: Acordo;
  pagamentos: Pagamento[];
  salvar?: boolean;
}

const mm = (value: number) => value;
const margem = 18;
const larguraPagina = 210;
const alturaPagina = 297;
const larguraConteudo = larguraPagina - margem * 2;

const moeda = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

const dataBR = (value?: string | null) => {
  if (!value) return '—';
  const apenasData = value.slice(0, 10);
  const [ano, mes, dia] = apenasData.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : value;
};

const slug = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const formatarNumeroAcordo = (id: string) => id.slice(0, 8).toUpperCase();

async function carregarImagem(url: string, recortarTransparencia = false): Promise<string> {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error('Não foi possível carregar uma das marcas do documento.');
  const blob = await resposta.blob();
  const enderecoTemporario = URL.createObjectURL(blob);
  return await new Promise((resolve, reject) => {
    const imagem = new Image();
    imagem.onload = () => {
      const canvasOriginal = document.createElement('canvas');
      canvasOriginal.width = imagem.naturalWidth;
      canvasOriginal.height = imagem.naturalHeight;
      const contextoOriginal = canvasOriginal.getContext('2d');
      if (!contextoOriginal) {
        URL.revokeObjectURL(enderecoTemporario);
        reject(new Error('Não foi possível preparar uma das marcas do documento.'));
        return;
      }
      contextoOriginal.drawImage(imagem, 0, 0);

      let origemX = 0;
      let origemY = 0;
      let origemLargura = imagem.naturalWidth;
      let origemAltura = imagem.naturalHeight;
      if (recortarTransparencia) {
        const pixels = contextoOriginal.getImageData(0, 0, imagem.naturalWidth, imagem.naturalHeight).data;
        let minX = imagem.naturalWidth;
        let minY = imagem.naturalHeight;
        let maxX = -1;
        let maxY = -1;
        for (let py = 0; py < imagem.naturalHeight; py += 1) {
          for (let px = 0; px < imagem.naturalWidth; px += 1) {
            if (pixels[(py * imagem.naturalWidth + px) * 4 + 3] > 12) {
              minX = Math.min(minX, px);
              minY = Math.min(minY, py);
              maxX = Math.max(maxX, px);
              maxY = Math.max(maxY, py);
            }
          }
        }
        if (maxX >= minX && maxY >= minY) {
          const margemRecorte = Math.max(4, Math.round((maxY - minY + 1) * 0.08));
          origemX = Math.max(0, minX - margemRecorte);
          origemY = Math.max(0, minY - margemRecorte);
          origemLargura = Math.min(imagem.naturalWidth - origemX, maxX - origemX + 1 + margemRecorte);
          origemAltura = Math.min(imagem.naturalHeight - origemY, maxY - origemY + 1 + margemRecorte);
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = origemLargura;
      canvas.height = origemAltura;
      const contexto = canvas.getContext('2d');
      if (!contexto) {
        URL.revokeObjectURL(enderecoTemporario);
        reject(new Error('Não foi possível preparar uma das marcas do documento.'));
        return;
      }
      contexto.fillStyle = '#ffffff';
      contexto.fillRect(0, 0, canvas.width, canvas.height);
      contexto.drawImage(canvasOriginal, origemX, origemY, origemLargura, origemAltura, 0, 0, origemLargura, origemAltura);
      URL.revokeObjectURL(enderecoTemporario);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    imagem.onerror = () => {
      URL.revokeObjectURL(enderecoTemporario);
      reject(new Error('Não foi possível preparar uma das marcas do documento.'));
    };
    imagem.src = enderecoTemporario;
  });
}

export async function gerarTermoAcordoPdf({ acordo, pagamentos, salvar = true }: GerarTermoAcordoOptions) {
  if (pagamentos.length === 0) {
    throw new Error('As parcelas deste acordo não foram encontradas.');
  }

  const [{ default: jsPDF }, logoSouza, logoCredor] = await Promise.all([
    import('jspdf'),
    carregarImagem(souzaRibeiroAsset.url),
    carregarImagem(
      acordo.empresa === 'mundo_da_moda' ? umeAsset.url : novoMundoAsset.url,
      acordo.empresa !== 'mundo_da_moda',
    ),
  ]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const credor = getEmpresaLabel(acordo.empresa);
  const parcelasOrdenadas = [...pagamentos].sort((a, b) => a.numero_parcela - b.numero_parcela);
  const emitidoEm = new Date().toLocaleDateString('pt-BR');
  const identificador = formatarNumeroAcordo(acordo.id);
  let y = 0;

  const novaPagina = () => {
    doc.addPage();
    y = 24;
  };

  const garantirEspaco = (altura: number) => {
    if (y + altura > alturaPagina - 22) novaPagina();
  };

  const texto = (conteudo: string, tamanho = 9.5, negrito = false, espacamento = 4.6) => {
    doc.setFont('helvetica', negrito ? 'bold' : 'normal');
    doc.setFontSize(tamanho);
    doc.setTextColor(33, 37, 41);
    const linhas = doc.splitTextToSize(conteudo, larguraConteudo) as string[];
    garantirEspaco(linhas.length * espacamento + 2);
    doc.text(linhas, margem, y, { lineHeightFactor: 1.35, align: 'justify', maxWidth: larguraConteudo });
    y += linhas.length * espacamento + 2;
  };

  const tituloClausula = (titulo: string) => {
    garantirEspaco(10);
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(20, 58, 92);
    doc.text(titulo, margem, y);
    y += 6;
  };

  // Cabeçalho institucional
  doc.addImage(logoSouza, 'JPEG', margem, 12, 74, 21);
  if (acordo.empresa === 'mundo_da_moda') {
    doc.addImage(logoCredor, 'JPEG', 164, 9, 24, 24);
  } else {
    doc.addImage(logoCredor, 'JPEG', 139, 15, 53, 13);
  }
  doc.setDrawColor(20, 58, 92);
  doc.setLineWidth(0.7);
  doc.line(margem, 38, larguraPagina - margem, 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(20, 58, 92);
  doc.text('TERMO DE ACORDO EXTRAJUDICIAL', larguraPagina / 2, 49, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(95, 101, 109);
  doc.text(`Acordo nº ${identificador}  •  Emitido em ${emitidoEm}`, larguraPagina / 2, 55, { align: 'center' });
  y = 65;

  // Identificação
  doc.setFillColor(244, 247, 250);
  doc.roundedRect(margem, y, larguraConteudo, 29, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setTextColor(95, 101, 109);
  doc.text('CREDOR', margem + 5, y + 7);
  doc.text('DEVEDOR(A)', margem + 5, y + 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(25, 29, 33);
  doc.text(credor, margem + 34, y + 7);
  doc.text(acordo.cliente_nome, margem + 34, y + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`CPF: ${acordo.cliente_cpf || 'não informado'}`, margem + 34, y + 24);
  y += 37;

  // Resumo financeiro
  const resumo = [
    ['VALOR DO ACORDO', moeda(acordo.valor_total)],
    ['PARCELAS', `${acordo.parcelas}`],
    ['1º VENCIMENTO', dataBR(acordo.data_primeiro_pagamento)],
  ];
  const coluna = larguraConteudo / resumo.length;
  resumo.forEach(([rotulo, valor], index) => {
    const x = margem + index * coluna;
    doc.setDrawColor(218, 223, 229);
    doc.rect(x, y, coluna, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(95, 101, 109);
    doc.text(rotulo, x + 4, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(25, 29, 33);
    doc.text(valor, x + 4, y + 13);
  });
  y += 27;

  tituloClausula('CLÁUSULA PRIMEIRA — DO OBJETO E RECONHECIMENTO');
  texto(`O(A) DEVEDOR(A) reconhece a negociação realizada com ${credor}, intermediada pela Souza e Ribeiro Advocacia e Cobrança, e declara ciência das condições de pagamento descritas neste instrumento, referentes à obrigação que deu origem ao acordo.`);

  tituloClausula('CLÁUSULA SEGUNDA — DAS CONDIÇÕES DE PAGAMENTO');
  texto(`O valor total negociado é de ${moeda(acordo.valor_total)}, a ser pago em ${acordo.parcelas} parcela(s), conforme o cronograma abaixo. A quitação de cada parcela somente ocorrerá após a efetiva compensação do respectivo pagamento.`);

  garantirEspaco(26);
  const larguras = [26, 46, 52, 50];
  const cabecalhos = ['PARCELA', 'VENCIMENTO', 'VALOR', 'SITUAÇÃO'];
  const desenharCabecalhoTabela = () => {
    let inicioColuna = margem;
    doc.setFillColor(20, 58, 92);
    doc.rect(margem, y, larguraConteudo, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    cabecalhos.forEach((cabecalho, index) => {
      doc.text(cabecalho, inicioColuna + larguras[index] / 2, y + 6.4, { align: 'center' });
      inicioColuna += larguras[index];
    });
    y += 10;
  };
  desenharCabecalhoTabela();

  parcelasOrdenadas.forEach((pagamento, index) => {
    if (y + 11 > alturaPagina - 22) {
      novaPagina();
      desenharCabecalhoTabela();
    }
    let inicioColuna = margem;
    if (index % 2 === 0) {
      doc.setFillColor(247, 249, 251);
      doc.rect(margem, y, larguraConteudo, 11, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(40, 44, 48);
    const situacao = pagamento.status === 'pago' ? `Pago em ${dataBR(pagamento.data_paga)}` : 'Pendente';
    [`${pagamento.numero_parcela}/${parcelasOrdenadas.length}`, dataBR(pagamento.data_prevista), moeda(pagamento.valor_parcela), situacao].forEach((valor, colunaIndex) => {
      doc.text(valor, inicioColuna + larguras[colunaIndex] / 2, y + 7, { align: 'center' });
      inicioColuna += larguras[colunaIndex];
    });
    y += 11;
  });

  tituloClausula('CLÁUSULA TERCEIRA — DA COMPROVAÇÃO E QUITAÇÃO');
  texto('Os comprovantes de pagamento deverão ser conservados pelo(a) DEVEDOR(A). A quitação será reconhecida individualmente após a confirmação de cada parcela e, de forma integral, somente depois da compensação de todas as parcelas previstas neste termo.');

  tituloClausula('CLÁUSULA QUARTA — DO INADIMPLEMENTO');
  texto('O não pagamento de qualquer parcela no vencimento poderá sujeitar o acordo às consequências previstas na obrigação original e na legislação aplicável. Este instrumento não cria multa, juros, prazo de tolerância ou penalidade além daqueles que sejam legalmente aplicáveis ou que já constem da relação contratual de origem.');

  tituloClausula('CLÁUSULA QUINTA — DA OBRIGAÇÃO ORIGINAL');
  texto('O presente acordo disciplina exclusivamente as condições de pagamento aqui registradas. As demais condições válidas da obrigação original permanecem preservadas naquilo que não contrariar este instrumento, até a quitação integral do valor negociado.');

  tituloClausula('CLÁUSULA SEXTA — DA PROTEÇÃO DE DADOS');
  texto('Os dados pessoais constantes deste documento serão tratados exclusivamente para formalização, execução, acompanhamento e comprovação do acordo, observadas as normas aplicáveis de proteção de dados pessoais.');

  tituloClausula('CLÁUSULA SÉTIMA — DAS DISPOSIÇÕES GERAIS');
  texto('As partes declaram que compreenderam e aceitaram as condições descritas neste termo. Eventual tolerância quanto ao cumprimento de qualquer obrigação não representa renúncia de direito. Questões não previstas serão resolvidas conforme a legislação aplicável e os documentos da relação original.');

  garantirEspaco(43);
  y += 7;
  doc.setFillColor(244, 247, 250);
  doc.setDrawColor(218, 223, 229);
  doc.roundedRect(margem, y, larguraConteudo, 34, 2, 2, 'FD');
  const informacoes = [
    ['CLIENTE', acordo.cliente_nome],
    ['CPF', acordo.cliente_cpf || 'não informado'],
    ['CREDOR', credor],
    ['INTERMEDIAÇÃO', 'Souza e Ribeiro Advocacia e Cobrança — empresa terceirizada de cobrança'],
  ];
  informacoes.forEach(([rotulo, valor], index) => {
    const linhaY = y + 7 + index * 7.2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(95, 101, 109);
    doc.text(rotulo, margem + 5, linhaY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 34, 38);
    doc.text(valor, margem + 34, linhaY);
  });

  const totalPaginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
    doc.setPage(pagina);
    doc.setDrawColor(218, 223, 229);
    doc.line(margem, alturaPagina - 16, larguraPagina - margem, alturaPagina - 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(110, 116, 122);
    doc.text(`Acordo ${identificador} • Souza e Ribeiro Advocacia e Cobrança`, margem, alturaPagina - 10);
    doc.text(`Página ${pagina} de ${totalPaginas}`, larguraPagina - margem, alturaPagina - 10, { align: 'right' });
  }

  const nomeArquivo = `termo-acordo-${slug(credor)}-${slug(acordo.cliente_nome)}.pdf`;
  if (salvar) doc.save(nomeArquivo);
  return { doc, nomeArquivo };
}