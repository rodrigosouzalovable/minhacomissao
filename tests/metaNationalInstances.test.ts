import { describe, expect, test } from 'bun:test';
import { isBrazilianInstancePhone, nationalInstanceCount, nationalMassSelection, nationalSelectionIds } from '../src/lib/metaNationalInstances';

describe('Instâncias nacionais no Envio Meta e contagens', () => {
  test('reconhece DDI brasileiro em formatos Meta', () => {
    for (const phone of ['5562982756444', '+55 (62) 98275-6444', '0055 62 98275-6444', '+55 62 3275-6444']) {
      expect(isBrazilianInstancePhone(phone)).toBe(true);
    }
  });
  test('reconhece formato local brasileiro válido sem duplicar DDI', () => {
    expect(isBrazilianInstancePhone('(62) 98275-6444')).toBe(true);
    expect(isBrazilianInstancePhone('6232756444')).toBe(true);
    expect(isBrazilianInstancePhone('55982756444')).toBe(true); // DDD 55, not DDI
  });
  test('internacionais da imagem não são brasileiros com ou sem sinal +', () => {
    for (const phone of ['+1 555-360-7120', '15553607120', '+1 555-382-6927', '15553826927', '0015553989636']) {
      expect(isBrazilianInstancePhone(phone)).toBe(false);
    }
  });
  test('outros países não entram nem por comprimento semelhante ao brasileiro', () => {
    for (const phone of ['+44 20 7946 0958', '442079460958', '+49 15912345678', '+62 982756444', '+55 15553826927']) {
      expect(isBrazilianInstancePhone(phone)).toBe(false);
    }
  });
  test('DDI isolado, DDD inválido, ausentes e identificadores não contam', () => {
    for (const phone of [null, undefined, '', '55', '5523982756444', '556298275644', 'TESTE 5562982756444', '123456789012345']) {
      expect(isBrazilianInstancePhone(phone)).toBe(false);
    }
  });
  const instances = [
    { id: 'br-green', display_phone: '+55 62 98275-6444', saude_quality: 'GREEN', meta_bm_id: 'a', instancia_teste_aquecimento: false },
    { id: 'br-test-red', display_phone: '5562982756445', saude_quality: 'RED', meta_bm_id: 'a', instancia_teste_aquecimento: true },
    { id: 'us-green', display_phone: '+1 555-360-7120', saude_quality: 'GREEN', meta_bm_id: 'a', instancia_teste_aquecimento: true },
    { id: 'br-unknown', display_phone: '5562982756446', saude_quality: 'UNKNOWN', meta_bm_id: null, instancia_teste_aquecimento: false },
    { id: 'us-red', display_phone: '15553826927', saude_quality: 'RED', meta_bm_id: null, instancia_teste_aquecimento: true },
    { id: 'br-yellow', display_phone: '5562982756447', saude_quality: 'YELLOW', meta_bm_id: 'b', instancia_teste_aquecimento: false },
  ];
  test('sem filtro seleciona apenas nacionais GREEN ou sem qualidade', () => {
    expect(nationalMassSelection(instances, false).map((i) => i.id)).toEqual(['br-green', 'br-unknown']);
  });
  test('filtro RED explícito seleciona nacionais RED, nunca internacionais', () => {
    expect(nationalMassSelection(instances.filter((i) => i.saude_quality === 'RED'), true).map((i) => i.id)).toEqual(['br-test-red']);
  });
  test('filtro YELLOW e filtro BM preservam somente nacionais visíveis', () => {
    expect(nationalMassSelection(instances.filter((i) => i.saude_quality === 'YELLOW'), true).map((i) => i.id)).toEqual(['br-yellow']);
    expect(nationalMassSelection(instances.filter((i) => i.meta_bm_id === 'a'), true).map((i) => i.id)).toEqual(['br-green', 'br-test-red']);
  });
  test('seleção individual ou antiga não pode manter internacional ou ID ausente', () => {
    expect(nationalSelectionIds(['us-green'], instances)).toEqual([]);
    expect(nationalSelectionIds(['br-green', 'us-green', 'missing', 'br-test-red'], instances)).toEqual(['br-green', 'br-test-red']);
  });
  test('contagem geral e por BM inclui brasileiros de teste e exclui internacionais', () => {
    expect(nationalInstanceCount(instances)).toBe(4);
    expect(nationalInstanceCount(instances.filter((i) => i.meta_bm_id === 'a'))).toBe(2);
    expect(nationalInstanceCount(instances.filter((i) => !i.meta_bm_id))).toBe(1);
  });
});