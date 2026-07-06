// Regras de desconto do Portal público de negociação.
// Baseadas em dias de atraso da parcela mais antiga do cliente.

export type ModalidadePortal = 'avista' | 'parcelado';

export function getDiasAtraso(
  debitos: { data_vencimento: string | null | undefined }[]
): number {
  const timestamps = debitos
    .map((d) => d.data_vencimento)
    .filter((v): v is string => !!v)
    .map((v) => new Date(v + 'T00:00:00').getTime())
    .filter((t) => !Number.isNaN(t));
  if (!timestamps.length) return 0;
  const oldest = Math.min(...timestamps);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diff = Math.floor((hoje.getTime() - oldest) / 86400000);
  return Math.max(0, diff);
}

// Faixas:
//   1 - 200 dias:  parcelado 0% / à vista 10%
// 201 - 300 dias:  parcelado 10% / à vista 20%
// 301 - 500 dias:  parcelado 20% / à vista 30%
// 501 - 10000 dias: parcelado 30% / à vista 50%
export function getDescontoPortal(dias: number, modalidade: ModalidadePortal): number {
  if (dias <= 200) return modalidade === 'avista' ? 10 : 0;
  if (dias <= 300) return modalidade === 'avista' ? 20 : 10;
  if (dias <= 500) return modalidade === 'avista' ? 30 : 20;
  return modalidade === 'avista' ? 50 : 30;
}

export function getDescontoMaximoPortal(dias: number): number {
  return getDescontoPortal(dias, 'avista');
}
