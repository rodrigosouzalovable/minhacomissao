// Mapeia o valor de empresa armazenado no banco para o rótulo exibido na UI.
// Os valores no banco permanecem inalterados (ume_novo_mundo, mundo_da_moda)
// para preservar acordos antigos.
export const EMPRESA_LABELS: Record<string, string> = {
  ume_novo_mundo: 'UME | INADIMPLENTES',
  mundo_da_moda: 'UME | APORTE',
};

export function getEmpresaLabel(valor?: string | null): string {
  if (!valor) return 'UME | INADIMPLENTES';
  return EMPRESA_LABELS[valor] ?? valor;
}
