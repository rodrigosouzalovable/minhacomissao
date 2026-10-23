import { describe, expect, test } from 'bun:test';
import { approvedGreenSelectionIds } from '../src/lib/metaNationalInstances';

const row = (id: string, saude_quality: string | null = 'GREEN') => ({ id, saude_quality, display_phone: '+55 62 8269-8799' });

describe('Selecionar instâncias aprovadas GREEN', () => {
  test('seleciona GREEN e desconhecida aprovadas, exclui YELLOW/RED', () => {
    const rows = [row('green'), row('yellow', 'YELLOW'), row('red', 'RED'), row('unknown', 'UNKNOWN'), row('empty', ''), row('null', null)];
    expect(approvedGreenSelectionIds(rows, new Set(rows.map(i => i.id)))).toEqual(['green', 'unknown', 'empty', 'null']);
  });
  test('exige aprovação do template escolhido', () => {
    expect(approvedGreenSelectionIds([row('approved'), row('missing')], new Set(['approved']))).toEqual(['approved']);
  });
  test('exclui internacional e banida mesmo GREEN e aprovadas', () => {
    const rows = [row('ok'), { ...row('international'), display_phone: '+1 555-945-7201' }, { ...row('banned'), saude_status: 'BANNED' }, { ...row('ban-info'), saude_ban_info: { reason: 'SPAM' } }];
    expect(approvedGreenSelectionIds(rows, new Set(rows.map(i => i.id)))).toEqual(['ok']);
  });
  test('não seleciona IDs fora da lista autorizada nem duplica IDs', () => {
    expect(approvedGreenSelectionIds([row('own'), row('own')], new Set(['own', 'foreign']))).toEqual(['own']);
  });
  test('produz a seleção substituta sem conservar escolhas incompatíveis', () => {
    let selected = ['old-red', 'old-without-approval'];
    selected = approvedGreenSelectionIds([row('new-green'), row('old-red', 'RED'), row('old-without-approval')], new Set(['new-green', 'old-red']));
    expect(selected).toEqual(['new-green']);
  });
  test('retorna vazio sem GREEN aprovado', () => {
    expect(approvedGreenSelectionIds([row('red', 'RED')], new Set(['red']))).toEqual([]);
  });
});