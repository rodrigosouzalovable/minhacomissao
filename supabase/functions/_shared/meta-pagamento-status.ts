export type PagamentoEstado = 'confirmado' | 'pendente' | 'outra_restricao' | 'nao_confirmado';

const restritos = new Set(['BLOCKED', 'LIMITED', 'RESTRICTED']);

export function classificarPagamento(phoneHealth: any, wabaHealth: any): PagamentoEstado {
  const entities = [
    ...(Array.isArray(phoneHealth?.entities) ? phoneHealth.entities : []),
    ...(Array.isArray(wabaHealth?.entities) ? wabaHealth.entities : []),
  ];
  const comerciais = entities.filter((e: any) => ['BUSINESS', 'WABA'].includes(String(e?.entity_type).toUpperCase()));
  const bloqueadas = comerciais.filter((e: any) => restritos.has(String(e?.can_send_message).toUpperCase()));
  if (bloqueadas.length) {
    const pagamentoExplicito = bloqueadas.some((e: any) =>
      /131042|141006|payment|billing|pagamento|faturamento/i.test(JSON.stringify(e?.additional_info || [])));
    return pagamentoExplicito ? 'pendente' : 'outra_restricao';
  }
  const disponivel = (tipo: string) => comerciais.some((e: any) =>
    String(e?.entity_type).toUpperCase() === tipo && String(e?.can_send_message).toUpperCase() === 'AVAILABLE');
  return disponivel('BUSINESS') && disponivel('WABA') ? 'confirmado' : 'nao_confirmado';
}

export function podeLimparTravaPagamento(inst: any, estado: PagamentoEstado, phone: any): boolean {
  const motivo = String(inst?.pausa_automatica_motivo || '');
  const apenasPagamento = /131042|141006|payment|billing|pagamento|faturamento/i.test(motivo) &&
    !/131031|account_violation|banned|flagged|status=|quality=|qualidade|locked|banimento/i.test(motivo);
  const health = phone?.health_status;
  const entidades = Array.isArray(health?.entities) ? health.entities : [];
  return estado === 'confirmado' && apenasPagamento && inst?.pool_fora_manual !== true &&
    inst?.ativo !== false && String(phone?.status).toUpperCase() === 'CONNECTED' &&
    String(phone?.quality_rating).toUpperCase() === 'GREEN' &&
    String(health?.can_send_message).toUpperCase() === 'AVAILABLE' &&
    !entidades.some((e: any) => restritos.has(String(e?.can_send_message).toUpperCase())) &&
    !(inst?.quarentena_ate && new Date(inst.quarentena_ate).getTime() > Date.now()) &&
    inst?.recuperacao_ativa !== true;
}