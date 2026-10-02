// Mapeia o valor de empresa armazenado no banco para o rótulo exibido na UI.
export type EmpresaAcordo = 'ume_novo_mundo' | 'mundo_da_moda' | 'odres_cred';

export const EMPRESA_LABELS: Record<string, string> = {
  ume_novo_mundo: 'NOVO MUNDO',
  mundo_da_moda: 'UME',
  odres_cred: 'ODRES CRED',
};

export const EMPRESAS_ACORDO: EmpresaAcordo[] = ['ume_novo_mundo', 'mundo_da_moda', 'odres_cred'];

export function getEmpresaLabel(valor?: string | null): string {
  if (!valor) return '-';
  return EMPRESA_LABELS[valor] ?? valor;
}
