import { describe, expect, test } from 'bun:test';
import { partitionRecipientLines, validRecipientPhone } from '../src/lib/metaRecipientValidation';

describe('Ignorar destinatários inválidos sem bloquear os válidos', () => {
  test('ignora 32919332 e preserva dois clientes com todos os dados e primeira linha', () => {
    const first = '62982756444;Cliente A;12345678901;10;100';
    const last = '+55 (62) 98275-6445;Cliente B;98765432100;20;200';
    expect(partitionRecipientLines(`${first}\n32919332;Cliente inválido\n${last}`))
      .toEqual({ validRaw: `${first}\n${last}`, ignored: 1 });
  });
  test('informa dois ignorados e mantém somente o válido na lista da campanha', () => {
    expect(partitionRecipientLines('32919332\n123\n62982756444'))
      .toEqual({ validRaw: '62982756444', ignored: 2 });
  });
  test('lista totalmente inválida não deixa destinatários para disparar', () => {
    expect(partitionRecipientLines('32919332\n123\nsem telefone'))
      .toEqual({ validRaw: '', ignored: 3 });
  });
  test('preserva DDD brasileiro e DDI explícito sem inventar prefixo para incompletos', () => {
    expect(validRecipientPhone('32919332')).toBeNull();
    expect(validRecipientPhone('6232919332')).toBe('556232919332');
    expect(validRecipientPhone('62982756444')).toBe('5562982756444');
    expect(validRecipientPhone('+44 20 7946 0958')).toBe('442079460958');
    expect(validRecipientPhone('0044 20 7946 0958')).toBe('442079460958');
    expect(validRecipientPhone('15553607120')).toBe('15553607120');
    expect(validRecipientPhone('442079460958')).toBeNull();
  });
  test('não remove duplicações válidas nem linhas por falta de CPF ou gratuidade', () => {
    const input = '62982756444;Cliente A\n62982756444;Cliente A';
    expect(partitionRecipientLines(input)).toEqual({ validRaw: input, ignored: 0 });
  });
  test('rejeita caracteres inválidos, vazios, telefone longo e prefixos isolados', () => {
    for (const phone of ['', '+55', '00', 'a62982756444', '6.2982756444E+10', '1'.repeat(81)]) {
      expect(validRecipientPhone(phone)).toBeNull();
    }
    expect(partitionRecipientLines('\n \n')).toEqual({ validRaw: '', ignored: 0 });
  });
});