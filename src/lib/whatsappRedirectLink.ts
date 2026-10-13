/** Builds a meusacordos.com.br redirect link that opens WhatsApp with a preset message. */
export function normalizarTelefoneWhatsapp(telefone: string): string | null {
  let d = telefone.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (!d.startsWith("55") || (d.length !== 12 && d.length !== 13)) return null;
  return d;
}

export function montarLinkWhatsappRedirect(telefone: string, mensagem: string): string | null {
  const numero = normalizarTelefoneWhatsapp(telefone);
  if (!numero) return null;
  const texto = mensagem.trim();
  const base = `https://wa.me/${numero}`;
  const destino = texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
  return `https://meusacordos.com.br/${destino}`;
}
