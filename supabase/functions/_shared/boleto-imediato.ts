// Pedido de boleto/PIX (botão "QUERO O BOLETO" ou texto explícito) em conversas UME/Odres Cred.
// Responde na hora, mesmo com atendente humano vinculado (o atendente continua na conversa).

export const ehPedidoBoletoImediato = (t: string) =>
  /(boleto|\bpix\b|c[oó]digo de barras|linha digit[aá]vel|segunda via|2ª via)/i.test(String(t || ''));

export const credorBoletoAutomatico = (credor: string) =>
  /\bUME\b|odres|novo\s*mundo/i.test(String(credor || ''));

/** Sábado/domingo => próxima segunda; dia útil => o próprio dia (data ISO em BRT). */
export function vencimentoDiaUtil(hojeIso: string): string {
  const d = new Date(`${hojeIso}T12:00:00Z`);
  const dow = d.getUTCDay();
  const add = dow === 6 ? 2 : dow === 0 ? 1 : 0;
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}
