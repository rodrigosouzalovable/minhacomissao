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

async function carregarImagem(url: string): Promise<string> {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error('Não foi possível carregar uma das marcas do documento.');
  const blob = await resposta.blob();
  const enderecoTemporario = URL.createObjectURL(blob);
  return await new Promise((resolve, reject) => {
    const imagem = new Image();
    imagem.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = imagem.naturalWidth;
      canvas.height = imagem.naturalHeight;
      const contexto = canvas.getContext('2d');
      if (!contexto) {
        URL.revokeObjectURL(enderecoTemporario);
        reject(new Error('Não foi possível preparar uma das marcas do documento.'));
        return;
      }
      contexto.fillStyle = '#ffffff';
      contexto.fillRect(0, 0, canvas.width, canvas.height);
      contexto.drawImage(imagem, 0, 0);
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
    carregarImagem(acordo.empresa === 'mundo_da_moda' ? umeAsset.url : novoMundoAsset.url),
  ]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const credor = getEmpresaLabel(acordo.empresa);
  const parcelasOrdenadas = [...pagamentos].sort((a, b) => a.numero_parcela - b.numero_parcela);
  const emitidoEm = new Date().toLocaleDateString('pt-BR');
  const identificador = acordo.id.slice(0, 8).toUpperCase();
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
    doc.addImage(logoCredor, 'JPEG', 143, 11, 49, 22);
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

  garantirEspaco(22);
  const larguras = [22, 48, 58, 46];
  const cabecalhos = ['PARCELA', 'VENCIMENTO', 'VALOR', 'SITUAÇÃO'];
  let x = margem;
  doc.setFillColor(20, 58, 92);
  doc.rect(margem, y, larguraConteudo, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  cabecalhos.forEach((cabecalho, index) => {
    doc.text(cabecalho, x + 3, y + 5.2);
    x += larguras[index];
  });
  y += 8;

  parcelasOrdenadas.forEach((pagamento, index) => {
    garantirEspaco(8);
    x = margem;
    if (index % 2 === 0) {
      doc.setFillColor(247, 249, 251);
      doc.rect(margem, y, larguraConteudo, 8, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(40, 44, 48);
    const situacao = pagamento.status === 'pago' ? `Pago em ${dataBR(pagamento.data_paga)}` : 'Pendente';
    [`${pagamento.numero_parcela}/${parcelasOrdenadas.length}`, dataBR(pagamento.data_prevista), moeda(pagamento.valor_parcela), situacao].forEach((valor, colunaIndex) => {
      doc.text(valor, x + 3, y + 5.3);
      x += larguras[colunaIndex];
    });
    y += 8;
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

  garantirEspaco(58);
  y += 8;
  doc.setDrawColor(90, 96, 102);
  doc.line(margem, y, 91, y);
  doc.line(119, y, larguraPagina - margem, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 34, 38);
  doc.text(acordo.cliente_nome, 54.5, y + 5, { align: 'center' });
  doc.text(credor, 155.5, y + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`CPF: ${acordo.cliente_cpf || 'não informado'}`, 54.5, y + 10, { align: 'center' });
  doc.text('CREDOR', 155.5, y + 10, { align: 'center' });
  y += 27;
  doc.line(margem, y, 91, y);
  doc.line(119, y, larguraPagina - margem, y);
  doc.text('TESTEMUNHA 1 — Nome e CPF', 54.5, y + 5, { align: 'center' });
  doc.text('TESTEMUNHA 2 — Nome e CPF', 155.5, y + 5, { align: 'center' });

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