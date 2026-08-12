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
  if (dias <= 0) return 0;
  if (dias <= 200) return modalidade === 'avista' ? 10 : 0;
  if (dias <= 300) return modalidade === 'avista' ? 20 : 10;
  if (dias <= 500) return modalidade === 'avista' ? 30 : 20;
  return modalidade === 'avista' ? 50 : 30;
}

// ---------------------------------------------------------------------------
// Faixas customizadas por credor (tabela credor_desconto_faixas)
// ---------------------------------------------------------------------------

export interface FaixaDescontoCredor {
  dias_de: number;
  dias_ate: number | null; // null = sem limite
  desc_avista: number;
  desc_parcelado: number;
}

/** Normaliza o nome do credor para comparação/gravação. */
export function normalizeCredor(v: string | null | undefined): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Desconto considerando faixas customizadas do credor.
 * Se não houver faixas cadastradas, cai nas regras padrão do sistema.
 */
export function getDescontoComFaixas(
  dias: number,
  modalidade: ModalidadePortal,
  faixas?: FaixaDescontoCredor[] | null
): number {
  if (!faixas || faixas.length === 0) return getDescontoPortal(dias, modalidade);
  const d = Math.max(0, dias);
  const hit = faixas.find(
    (f) => d >= (f.dias_de ?? 0) && (f.dias_ate == null || d <= f.dias_ate)
  );
  if (!hit) return 0;
  const v = modalidade === 'avista' ? hit.desc_avista : hit.desc_parcelado;
  return Math.max(0, Math.min(100, Number(v) || 0));
}

export function getDescontoMaximoPortal(
  dias: number,
  faixas?: FaixaDescontoCredor[] | null
): number {
  return getDescontoComFaixas(dias, 'avista', faixas);
}
