// Detecta código Pix "Copia e Cola" (payload EMV BR Code) dentro de um texto livre.
// Ex.: "Segue o Pix: 000201...6304ABCD" -> retorna somente o payload.

const PIX_RE = /000201[0-9A-Za-z.\-*:\/+_@]{40,600}?6304[0-9A-Fa-f]{4}/g;

export function extrairPix(texto?: string | null): string | null {
  const t = String(texto || '');
  if (!t.includes('000201')) return null;
  const matches = t.match(PIX_RE);
  if (!matches?.length) return null;
  // Escolhe o maior candidato (payloads Pix são longos) e valida marcadores mínimos
  const candidato = matches.sort((a, b) => b.length - a.length)[0];
  const valido = /br\.gov\.bcb\.pix/i.test(candidato) || candidato.length >= 60;
  return valido ? candidato : null;
}
