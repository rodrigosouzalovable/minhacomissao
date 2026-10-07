import { describe, expect, it } from 'bun:test';
import { classificarPagamento, podeLimparTravaPagamento } from '../supabase/functions/_shared/meta-pagamento-status';

const health = (business = 'AVAILABLE', waba = 'AVAILABLE', info: string[] = []) => ({
  can_send_message: 'AVAILABLE',
  entities: [
    { entity_type: 'BUSINESS', can_send_message: business, additional_info: info },
    { entity_type: 'WABA', can_send_message: waba },
    { entity_type: 'PHONE_NUMBER', can_send_message: 'AVAILABLE' },
  ],
});
const inst = { ativo: true, pausa_automatica_motivo: 'Business eligibility payment issue (#131042)', pool_fora_manual: false };
const phone = { status: 'CONNECTED', quality_rating: 'GREEN', health_status: health() };

describe('Verificação de pagamento antes do aviso', () => {
  it('BUSINESS e WABA disponíveis confirmam disponibilidade comercial', () => {
    expect(classificarPagamento(health(), null)).toBe('confirmado');
  });
  it('exige motivo de pagamento explícito na restrição comercial', () => {
    expect(classificarPagamento(health('BLOCKED', 'AVAILABLE', ['Business eligibility payment issue (#131042)']), null)).toBe('pendente');
    expect(classificarPagamento(health('BLOCKED'), null)).toBe('outra_restricao');
  });
  it('limitação exclusiva do número não é pendência de pagamento', () => {
    const h = health();
    h.entities[2].can_send_message = 'LIMITED';
    expect(classificarPagamento(h, null)).toBe('confirmado');
    expect(podeLimparTravaPagamento(inst, 'confirmado', { ...phone, health_status: h })).toBe(false);
  });
  it('consulta ausente ou sem WABA é inconclusiva', () => {
    expect(classificarPagamento(null, null)).toBe('nao_confirmado');
    expect(classificarPagamento({ entities: [{ entity_type: 'BUSINESS', can_send_message: 'AVAILABLE' }] }, null)).toBe('nao_confirmado');
  });
  it('remove somente pagamento resolvido com envio e qualidade confirmados', () => {
    expect(podeLimparTravaPagamento(inst, 'confirmado', phone)).toBe(true);
    expect(podeLimparTravaPagamento(inst, 'nao_confirmado', phone)).toBe(false);
    expect(podeLimparTravaPagamento(inst, 'pendente', phone)).toBe(false);
  });
  it('preserva exclusão manual', () => {
    expect(podeLimparTravaPagamento({ ...inst, pool_fora_manual: true }, 'confirmado', phone)).toBe(false);
  });
  it('preserva RED e YELLOW', () => {
    for (const quality_rating of ['RED', 'YELLOW']) expect(podeLimparTravaPagamento(inst, 'confirmado', { ...phone, quality_rating })).toBe(false);
  });
  it('preserva bloqueio real combinado com pagamento', () => {
    expect(podeLimparTravaPagamento({ ...inst, pausa_automatica_motivo: 'Business Account locked (#131031); payment (#131042)' }, 'confirmado', phone)).toBe(false);
  });
  it('preserva número desativado e recuperação', () => {
    expect(podeLimparTravaPagamento({ ...inst, ativo: false }, 'confirmado', phone)).toBe(false);
    expect(podeLimparTravaPagamento({ ...inst, recuperacao_ativa: true }, 'confirmado', phone)).toBe(false);
  });
});