// Números reservados para lembretes de pagamento e confirmação de acordos.
// Nunca entram nas campanhas criadas automaticamente (carteira SFTP, lotes extras, B2B, USA).
export const INSTANCIAS_SO_LEMBRETE = new Set<string>([
  'b103ac3e-5781-47c4-8e11-24a323f5f0ee', // Novo Mundo 3144
]);
export const semInstanciasSoLembrete = (ids: string[]) => ids.filter((id) => !INSTANCIAS_SO_LEMBRETE.has(id));
