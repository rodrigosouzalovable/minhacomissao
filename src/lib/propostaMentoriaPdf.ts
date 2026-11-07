import jsPDF from "jspdf";

type RGB = [number, number, number];
const NAVY: RGB = [11, 37, 69];
const AZUL: RGB = [19, 99, 183];
const VERDE: RGB = [22, 163, 74];
const DOURADO: RGB = [201, 151, 46];
const CINZA: RGB = [100, 112, 128];
const TEXTO: RGB = [30, 41, 59];
const FUNDO: RGB = [244, 247, 251];
const BORDA: RGB = [222, 229, 238];

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const so = (s: string) => (s || "").replace(/\D/g, "");
export const fmtCnpj = (s: string) => {
  const d = so(s);
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return s || "-";
};
export const fmtTel = (s: string) => {
  const d = so(s).replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return s || "-";
};
// Helvetica do jsPDF não tem setas e alguns símbolos: troca por equivalentes seguros.
const limpa = (t: string) => t.replace(/\s*→\s*/g, " / ").replace(/[^\x00-\xFF—–•…“”‘’]/g, "");

export interface PropostaDados {
  empresa: string; responsavel: string; cnpj: string; telefone: string;
  valorVista: string; valorParcelado: string; parcelas: string;
  pix: string; validade: string; obs: string;
  mensalAtual: number; e12: number; e24: number; payback: number;
  dores: string[][]; semanas: string[][]; checklist: string[];
}

async function carregarLogo(): Promise<string | null> {
  try {
    const r = await fetch("/favicon.png");
    if (!r.ok) return null;
    const b = await r.blob();
    return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.onerror = () => res(null); fr.readAsDataURL(b); });
  } catch { return null; }
}

export async function gerarPropostaMentoriaPdf(p: PropostaDados, logo?: string | null) {
  if (logo === undefined) logo = await carregarLogo();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 16, CW = W - 2 * M;
  const hoje = new Date();
  const numero = `MW-${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, "0")}${String(hoje.getDate()).padStart(2, "0")}-${so(p.cnpj).slice(-4) || "0001"}`;
  const validoAte = new Date(hoje.getTime() + (Number(p.validade) || 7) * 86400000).toLocaleDateString("pt-BR");
  let y = 0;

  const cor = (c: RGB) => doc.setTextColor(...c);
  const fonte = (s: number, b = false) => { doc.setFont("helvetica", b ? "bold" : "normal"); doc.setFontSize(s); };
  const txt = (t: string, x: number, yy: number, o?: any) => doc.text(limpa(t), x, yy, o);
  const linhas = (t: string, w: number) => doc.splitTextToSize(limpa(t), w) as string[];

  const cabecalhoInterno = () => {
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 14, "F");
    doc.setFillColor(...DOURADO); doc.rect(0, 14, W, 0.8, "F");
    fonte(8, true); doc.setTextColor(255, 255, 255);
    txt("PROPOSTA COMERCIAL • MENTORIA API OFICIAL WHATSAPP", M, 9);
    fonte(8); txt(numero, W - M, 9, { align: "right" });
    y = 24;
  };
  const garantir = (h: number) => { if (y + h > H - 20) { doc.addPage(); cabecalhoInterno(); } };
  const secao = (n: string, t: string, min = 18) => {
    garantir(min); y += 3;
    doc.setFillColor(...AZUL); doc.roundedRect(M, y - 4.5, 9, 6.5, 1.2, 1.2, "F");
    fonte(9, true); doc.setTextColor(255, 255, 255); txt(n, M + 4.5, y, { align: "center" });
    fonte(13, true); cor(NAVY); txt(t, M + 12, y);
    doc.setDrawColor(...BORDA); doc.setLineWidth(0.3); doc.line(M + 12 + doc.getTextWidth(limpa(t)) + 3, y - 1.5, W - M, y - 1.5);
    y += 7;
  };
  const check = (x: number, yy: number, c: RGB = VERDE) => {
    doc.setFillColor(...c); doc.circle(x, yy, 1.8, "F");
    doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.45);
    doc.line(x - 0.85, yy, x - 0.2, yy + 0.7); doc.line(x - 0.2, yy + 0.7, x + 0.95, yy - 0.7);
  };

  // ================= CAPA / CABEÇALHO =================
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 78, "F");
  doc.setFillColor(...AZUL); doc.triangle(W - 85, 0, W, 0, W, 78, "F");
  doc.setFillColor(16, 76, 145); doc.triangle(W - 40, 0, W, 0, W, 40, "F");
  doc.setFillColor(...DOURADO); doc.rect(0, 78, W, 1.2, "F");
  if (logo) { try { doc.addImage(logo, "PNG", M, 13, 14, 14); } catch { /* sem logo */ } }
  fonte(11, true); doc.setTextColor(255, 255, 255); txt("MEUS ACORDOS", M + (logo ? 18 : 0), 19);
  fonte(8); doc.setTextColor(190, 205, 225); txt("Tecnologia em comunicação e cobrança", M + (logo ? 18 : 0), 24.5);

  doc.setFillColor(...DOURADO); doc.roundedRect(M, 35, 46, 6, 3, 3, "F");
  fonte(7.5, true); cor(NAVY); txt("PROPOSTA COMERCIAL", M + 23, 39.1, { align: "center" });
  fonte(22, true); doc.setTextColor(255, 255, 255); txt("Mentoria API Oficial do WhatsApp", M, 53);
  fonte(12); doc.setTextColor(205, 218, 235); txt("+ Sistema Próprio de Disparos e Atendimento", M, 61);
  fonte(8.5); doc.setTextColor(170, 188, 212);
  txt(`Nº ${numero}   •   Emitida em ${hoje.toLocaleDateString("pt-BR")}   •   Válida até ${validoAte}`, M, 70);

  // ================= CARD CLIENTE =================
  y = 90;
  doc.setFillColor(...FUNDO); doc.setDrawColor(...BORDA); doc.setLineWidth(0.3);
  doc.roundedRect(M, y, CW, 30, 3, 3, "FD");
  doc.setFillColor(...AZUL); doc.rect(M, y + 3, 1.2, 24, "F");
  fonte(7.5, true); cor(AZUL); txt("PREPARADO PARA", M + 6, y + 7);
  fonte(13, true); cor(NAVY);
  txt(linhas((p.empresa || "Cliente").toUpperCase(), CW - 12)[0], M + 6, y + 14);
  const campos: [string, string][] = [
    ["RESPONSÁVEL", p.responsavel || "-"], ["CNPJ", fmtCnpj(p.cnpj)], ["TELEFONE", fmtTel(p.telefone)],
  ];
  campos.forEach(([k, v], i) => {
    const x = M + 6 + i * (CW - 12) / 3;
    fonte(6.8, true); cor(CINZA); txt(k, x, y + 21);
    fonte(9.5, true); cor(TEXTO); txt(v, x, y + 26);
  });
  y += 40;

  // ================= 1. SOLUÇÃO =================
  secao("01", "A solução");
  fonte(9.5); cor(TEXTO);
  const intro = linhas("Sua equipe passa a operar a API Oficial da Meta com autonomia total e recebe um sistema próprio de disparos e atendimento — sem mensalidades para agências ou plataformas intermediárias.", CW);
  txt(intro.join("\n"), M, y); y += intro.length * 4.6 + 4;

  const colW = (CW - 6) / 2;
  p.dores.forEach(([d, s], i) => {
    const col = i % 2, x = M + col * (colW + 6);
    if (col === 0) garantir(22);
    const ls = linhas(s, colW - 14);
    doc.setFillColor(255, 255, 255); doc.setDrawColor(...BORDA);
    doc.roundedRect(x, y, colW, 19, 2, 2, "FD");
    check(x + 6, y + 6);
    fonte(8.8, true); cor(NAVY); txt(linhas(d, colW - 14)[0], x + 10, y + 7);
    fonte(8); cor(CINZA); txt(ls.slice(0, 2).join("\n"), x + 10, y + 11.5);
    if (col === 1 || i === p.dores.length - 1) y += 23;
  });

  // ================= 2. CRONOGRAMA =================
  secao("02", "Cronograma de implantação — 4 semanas", 70);
  const cw4 = (CW - 9) / 4;
  garantir(52);
  doc.setDrawColor(...AZUL); doc.setLineWidth(0.6); doc.line(M + cw4 / 2, y + 5, W - M - cw4 / 2, y + 5);
  p.semanas.forEach(([t, d], i) => {
    const x = M + i * (cw4 + 3);
    doc.setFillColor(...(i === 3 ? DOURADO : AZUL)); doc.circle(x + cw4 / 2, y + 5, 4.5, "F");
    fonte(10, true); doc.setTextColor(255, 255, 255); txt(String(i + 1), x + cw4 / 2, y + 6.6, { align: "center" });
    doc.setFillColor(...FUNDO); doc.setDrawColor(...BORDA); doc.setLineWidth(0.3);
    doc.roundedRect(x, y + 12, cw4, 38, 2, 2, "FD");
    const [sem, nome] = t.split(/\s+—\s+/);
    fonte(7, true); cor(AZUL); txt((sem || "").toUpperCase(), x + 3, y + 17.5);
    fonte(9, true); cor(NAVY); txt(linhas(nome || t, cw4 - 6)[0], x + 3, y + 22.5);
    fonte(7.2); cor(CINZA); txt(linhas(d, cw4 - 6).slice(0, 6).join("\n"), x + 3, y + 27.5);
  });
  y += 56;

  // ================= 3. ENTREGÁVEIS =================
  const itens = [...p.checklist, "30 dias de suporte após a entrega"];
  secao("03", "Entregáveis", 50);
  const rows = Math.ceil(itens.length / 2);
  garantir(rows * 7 + 6);
  doc.setFillColor(...FUNDO); doc.setDrawColor(...BORDA); doc.roundedRect(M, y - 2, CW, rows * 7 + 4, 2, 2, "FD");
  itens.forEach((c, i) => {
    const col = i < rows ? 0 : 1, r = i % rows;
    const x = M + 6 + col * (CW / 2), yy = y + 3 + r * 7;
    check(x, yy - 1, AZUL);
    fonte(8.5); cor(TEXTO); txt(linhas(c, CW / 2 - 14)[0], x + 4, yy);
  });
  y += rows * 7 + 8;

  // ================= 4. ROI =================
  secao("04", "Retorno sobre o investimento", 90);
  const kpis: [string, string, RGB][] = [
    ["GASTO MENSAL ATUAL", brl(p.mensalAtual), CINZA],
    ["ECONOMIA EM 12 MESES", brl(p.e12), VERDE],
    ["ECONOMIA EM 24 MESES", brl(p.e24), VERDE],
    ["RETORNO (PAYBACK)", `${p.payback.toFixed(1).replace(".", ",")} meses`, AZUL],
  ];
  const kw = (CW - 9) / 4;
  kpis.forEach(([k, v, c], i) => {
    const x = M + i * (kw + 3);
    doc.setFillColor(255, 255, 255); doc.setDrawColor(...BORDA); doc.roundedRect(x, y, kw, 24, 2, 2, "FD");
    doc.setFillColor(...c); doc.rect(x, y, kw, 1.4, "F");
    fonte(6.8, true); cor(CINZA); txt(k, x + 4, y + 8);
    fonte(13, true); cor(c === CINZA ? TEXTO : c); txt(v, x + 4, y + 17);
  });
  y += 30;
  // gráfico de barras: custo plataforma x investimento único
  garantir(48);
  doc.setFillColor(...FUNDO); doc.setDrawColor(...BORDA); doc.roundedRect(M, y, CW, 44, 2, 2, "FD");
  fonte(8.5, true); cor(NAVY); txt("Custo acumulado em 24 meses", M + 5, y + 7);
  const invest = Number(p.valorVista) || 0;
  const plat = p.mensalAtual * 24;
  const max = Math.max(plat, invest, 1), bw = CW - 70;
  ([["Plataforma atual", plat, [220, 38, 38] as RGB], ["Com a mentoria", invest, VERDE]] as [string, number, RGB][])
    .forEach(([l, v, c], i) => {
      const yy = y + 16 + i * 12;
      fonte(8); cor(TEXTO); txt(l, M + 5, yy + 4);
      doc.setFillColor(...BORDA); doc.roundedRect(M + 38, yy, bw, 6, 1, 1, "F");
      doc.setFillColor(...c); doc.roundedRect(M + 38, yy, Math.max(2, bw * v / max), 6, 1, 1, "F");
      fonte(8, true); cor(c); txt(brl(v), W - M - 5, yy + 4.5, { align: "right" });
    });
  y += 50;

  // ================= 5. INVESTIMENTO =================
  secao("05", "Investimento", 70);
  garantir(50);
  const vista = Number(p.valorVista) || 0, parc = Number(p.valorParcelado) || 0, n = Number(p.parcelas) || 1;
  const iw = (CW - 6) / 2;
  // à vista (destaque)
  doc.setFillColor(...NAVY); doc.roundedRect(M, y, iw, 42, 3, 3, "F");
  doc.setFillColor(...DOURADO); doc.roundedRect(M + iw - 32, y + 5, 27, 5.5, 2.7, 2.7, "F");
  fonte(6.5, true); cor(NAVY); txt("RECOMENDADO", M + iw - 18.5, y + 8.7, { align: "center" });
  fonte(8, true); doc.setTextColor(180, 198, 222); txt("PAGAMENTO À VISTA", M + 6, y + 9);
  fonte(24, true); doc.setTextColor(255, 255, 255); txt(brl(vista), M + 6, y + 24);
  fonte(8); doc.setTextColor(190, 205, 225);
  if (parc > vista) txt(`Economia de ${brl(parc - vista)} em relação ao parcelado`, M + 6, y + 32);
  txt("PIX ou transferência", M + 6, y + 37);
  // parcelado
  const x2 = M + iw + 6;
  doc.setFillColor(255, 255, 255); doc.setDrawColor(...BORDA); doc.roundedRect(x2, y, iw, 42, 3, 3, "FD");
  fonte(8, true); cor(CINZA); txt("PAGAMENTO PARCELADO", x2 + 6, y + 9);
  fonte(10, true); cor(AZUL); txt(`${n}x de`, x2 + 6, y + 18);
  fonte(22, true); cor(NAVY); txt(brl(parc / n), x2 + 6, y + 27);
  fonte(8); cor(CINZA); txt(`Total de ${brl(parc)}`, x2 + 6, y + 35);
  y += 48;
  if (p.pix) {
    garantir(14);
    doc.setFillColor(236, 253, 243); doc.setDrawColor(...VERDE); doc.roundedRect(M, y, CW, 12, 2, 2, "FD");
    fonte(8, true); cor(VERDE); txt("CHAVE PIX PARA FECHAMENTO", M + 6, y + 7.5);
    fonte(10, true); cor(TEXTO); txt(/^\d{14}$/.test(so(p.pix)) && so(p.pix) === p.pix.replace(/\s/g, "") ? fmtCnpj(p.pix) : p.pix, W - M - 6, y + 7.8, { align: "right" });
    y += 18;
  }

  // ================= 6. CONDIÇÕES =================
  secao("06", "Condições gerais");
  [
    "O custo por mensagem é cobrado diretamente pela Meta no cartão da Business Manager do cliente.",
    "O sistema é implantado na infraestrutura em nuvem do próprio cliente; os custos de servidor são do cliente.",
    "Acompanhamento de 4 semanas + 30 dias de suporte. Suporte adicional mediante novo contrato.",
    `Esta proposta é válida até ${validoAte}.`,
  ].forEach((c) => {
    fonte(8.8); const ls = linhas(c, CW - 8); garantir(ls.length * 4.4 + 2);
    doc.setFillColor(...AZUL); doc.circle(M + 1.5, y - 1.2, 0.9, "F");
    fonte(8.8); cor(TEXTO); txt(ls.join("\n"), M + 5, y); y += ls.length * 4.4 + 2;
  });
  if (p.obs) {
    y += 2; fonte(8.8); const ls = linhas(p.obs, CW - 12); garantir(ls.length * 4.4 + 14);
    doc.setFillColor(255, 251, 235); doc.setDrawColor(...DOURADO);
    doc.roundedRect(M, y, CW, ls.length * 4.4 + 10, 2, 2, "FD");
    fonte(7.5, true); cor(DOURADO); txt("OBSERVAÇÕES", M + 6, y + 6);
    fonte(8.8); cor(TEXTO); txt(ls.join("\n"), M + 6, y + 11); y += ls.length * 4.4 + 14;
  }

  // ================= ASSINATURAS =================
  garantir(34); y = Math.max(y + 14, H - 58 > y + 14 ? H - 58 : y + 14);
  const sw = (CW - 20) / 2;
  doc.setDrawColor(...TEXTO); doc.setLineWidth(0.3);
  doc.line(M, y, M + sw, y); doc.line(W - M - sw, y, W - M, y);
  fonte(9, true); cor(NAVY);
  txt(linhas(p.empresa || "Contratante", sw)[0], M, y + 5); txt("MEUS ACORDOS", W - M - sw, y + 5);
  fonte(7.5); cor(CINZA);
  txt(`Contratante${p.responsavel ? " • " + p.responsavel : ""}`, M, y + 9.5); txt("Contratada", W - M - sw, y + 9.5);
  txt("Data: ____/____/________", M, y + 15); txt("Data: ____/____/________", W - M - sw, y + 15);

  // ================= RODAPÉ EM TODAS =================
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BORDA); doc.setLineWidth(0.3); doc.line(M, H - 12, W - M, H - 12);
    fonte(7); cor(CINZA);
    txt("Meus Acordos • meusacordos.com.br • Documento confidencial", M, H - 7);
    txt(`Página ${i} de ${total}`, W - M, H - 7, { align: "right" });
  }

  return doc;
}
