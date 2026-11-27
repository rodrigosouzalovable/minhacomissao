export const ODRES_TEMPLATE_NOVO = 'odres_notificacao_desbloqueio_pix_4';

// Recebe a data BRT da rotina e somente cópias Utility aprovadas em números aptos.
export function podeUsarNovoTemplateOdres(diaBrt: string, quantidadeApta: number): boolean {
  return diaBrt >= '2026-11-28' && quantidadeApta >= 3;
}