import { describe, expect, test } from 'bun:test';
import { isBrazilianInstancePhone, isBrazilianInstance, isBannedInstance, nationalInstanceCount, nationalMassSelection, nationalSelectionIds } from '../src/lib/metaNationalInstances';

describe('Instâncias nacionais no Envio Meta e contagens', () => {
  test('seleciona os nacionais 8799 e 2300 com telefone ausente e nome completo', () => {
    const rows = [
      { id: '8799', nome: 'SOUZA 62 8269-8799', display_phone: null, saude_quality: 'GREEN' },
      { id: '2300', nome: 'SOUZA 62 8270-2300', display_phone: '', saude_quality: 'GREEN' },
      { id: '7201', nome: 'TESTE 1 555-945-7201', display_phone: null, saude_quality: 'GREEN' },
    ];
    expect(nationalSelectionIds(['8799', '2300', '7201'], rows)).toEqual(['8799', '2300']);
    expect(nationalMassSelection(rows, false).map((i) => i.id)).toEqual(['8799', '2300']);
    expect(nationalInstanceCount(rows)).toBe(2);
  });
  test('telefone Meta prevalece sobre nome e não usa identificadores arbitrários', () => {
    expect(isBrazilianInstance({ nome: 'SOUZA 62 8269-8799', display_phone: '+1 555-945-7201' })).toBe(false);
    expect(isBrazilianInstance({ nome: 'Instância 6282698799' })).toBe(false);
    expect(isBrazilianInstance({ nome: 'SOUZA 62 8269-8799 EXTRA' })).toBe(false);
    expect(isBrazilianInstance({ nome: 'SOUZA', saude_raw: { display_phone_number: '+55 62 8269-8799' } })).toBe(true);
  });
  test('BANNED não entra em Selecionar todas mesmo com qualidade GREEN ou filtro ativo', () => {
    const rows = [
      { id: 'banned', display_phone: '+55 62 8269-8799', saude_status: ' banned ', saude_quality: 'GREEN' },
      { id: 'ok', display_phone: '+55 62 8270-2300', saude_status: 'CONNECTED', saude_quality: 'GREEN' },
    ];
    expect(nationalMassSelection(rows, false).map((i) => i.id)).toEqual(['ok']);
    expect(nationalMassSelection(rows, true).map((i) => i.id)).toEqual(['ok']);
    expect(nationalSelectionIds(['banned', 'ok'], rows)).toEqual(['ok']);
    expect(nationalInstanceCount(rows)).toBe(2); // Banimento não muda a nacionalidade.
  });
  test('banimento informado exclui seleção; objeto vazio não confirma banimento', () => {
    const rows = [
      { id: 'ban-info', display_phone: '+55 62 8269-8799', saude_status: 'CONNECTED', saude_quality: 'GREEN', saude_ban_info: { reason: 'SPAM' } },
      { id: 'empty', display_phone: '+55 62 8270-2300', saude_status: 'CONNECTED', saude_quality: 'GREEN', saude_ban_info: {} },
    ];
    expect(nationalMassSelection(rows, true).map((i) => i.id)).toEqual(['empty']);
    expect(isBannedInstance({ saude_ban_info: 'banned' })).toBe(true);
    expect(isBannedInstance({ saude_status: 'RESTRICTED', saude_ban_info: null })).toBe(false);
    expect(isBannedInstance({ saude_quality: 'RED' } as { saude_status?: string })).toBe(false);
  });
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
    for (const phone of ['+1 555-945-7201', '15559457201', '0015559457201', '+1 555-360-7120', '15553607120', '+1 555-382-6927', '15553826927', '0015553989636']) {
      expect(isBrazilianInstancePhone(phone)).toBe(false);
    }
  });
  test('outros países não entram nem por comprimento semelhante ao brasileiro', () => {
    for (const phone of ['+44 20 7946 0958', '442079460958', '+49 15912345678', '+62 982756444', '+55 15553826927']) {
      expect(isBrazilianInstancePhone(phone)).toBe(false);
    }
  });
  test('DDI isolado, DDD inválido, ausentes e identificadores não contam', () => {
    for (const phone of [null, undefined, '', '55', '5523982756444', '556218275644', 'TESTE 5562982756444', '123456789012345']) {
      expect(isBrazilianInstancePhone(phone)).toBe(false);
    }
  });
  test('brasileiros da imagem sem nono dígito são nacionais em todos os formatos', () => {
    for (const phone of ['+55 62 8243-5419', '+55 62 8243-5531', '556282435419', '556282435531', '00556282435419', '(62) 8243-5419', '6282435531']) {
      expect(isBrazilianInstancePhone(phone)).toBe(true);
    }
  });
  test('formatos antigos continuam nacionais em todos os prefixos de celular', () => {
    for (const prefix of ['6', '7', '8', '9']) {
      expect(isBrazilianInstancePhone(`+55 62 ${prefix}243-5419`)).toBe(true);
    }
    expect(isBrazilianInstancePhone('+55 62 1243-5419')).toBe(false);
    expect(isBrazilianInstancePhone('+55 23 8243-5419')).toBe(false);
    expect(isBrazilianInstancePhone('+55 62 8243-541')).toBe(false);
  });
  test('seleção individual, em massa e contagens preservam brasileiros antigos, excluindo +1 555', () => {
    const legacyInstances = [
      { id: '5419', display_phone: '+55 62 8243-5419', saude_quality: 'GREEN', meta_bm_id: 'a' },
      { id: '5531', display_phone: '+55 62 8243-5531', saude_quality: 'UNKNOWN', meta_bm_id: 'b' },
      { id: '7201', display_phone: '+1 555-945-7201', saude_quality: 'GREEN', meta_bm_id: 'a' },
    ];
    expect(nationalSelectionIds(['5419', '5531', '7201'], legacyInstances)).toEqual(['5419', '5531']);
    expect(nationalMassSelection(legacyInstances, false).map((i) => i.id)).toEqual(['5419', '5531']);
    expect(nationalMassSelection(legacyInstances, true).map((i) => i.id)).toEqual(['5419', '5531']);
    expect(nationalInstanceCount(legacyInstances)).toBe(2);
    expect(nationalInstanceCount(legacyInstances.filter((i) => i.meta_bm_id === 'a'))).toBe(1);
    expect(nationalInstanceCount(legacyInstances.filter((i) => i.meta_bm_id === 'b'))).toBe(1);
    expect(legacyInstances[0].display_phone).toBe('+55 62 8243-5419');
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