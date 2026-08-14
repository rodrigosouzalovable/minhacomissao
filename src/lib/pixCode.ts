// Detecta código Pix "Copia e Cola" (payload EMV BR Code) dentro de um texto livre.
// O payload pode conter espaços (ex.: nome do recebedor "NOVO MUNDO SA EM RECU").

const PIX_RE = /000201[0-9A-Za-z.\-*:\/+_@ ]{40,600}?6304[0-9A-Fa-f]{4}/g;

export function extrairPix(texto?: string | null): string | null {
  const t = String(texto || '');
  if (!t.includes('000201')) return null;
  // Analisa linha por linha para não atravessar quebras de linha
  const candidatos: string[] = [];
  for (const linha of t.split(/\r?\n/)) {
    const m = linha.match(PIX_RE);
    if (m) candidatos.push(...m);
  }
  if (!candidatos.length) return null;
  const codigo = candidatos.sort((a, b) => b.length - a.length)[0].trim();
  const valido = /br\.gov\.bcb\.pix/i.test(codigo) || codigo.length >= 60;
  return valido ? codigo : null;
}

// Separa o texto do atendente do código Pix, para enviar o Pix em mensagem própria
// (o WhatsApp só mostra o botão "Copiar código Pix" quando o código está limpo).
export function separarPix(texto?: string | null): { resto: string; pix: string | null } {
  const t = String(texto || '');
  const pix = extrairPix(t);
  if (!pix) return { resto: t, pix: null };
  const resto = t.replace(pix, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { resto, pix };
}
