/** Etiquetas internas de atendente ("Atendente: Nome") — nunca exibidas a clientes USA B2B. */
export function ehEtiquetaAtendente(nome: string | null | undefined): boolean {
  return /^\s*atendente\s*:/i.test(nome ?? '');
}
