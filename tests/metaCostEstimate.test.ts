import { describe, expect, test } from 'bun:test';
import { estimateMetaCost, type CostWindow } from '../src/lib/metaCostEstimate';

const now = Date.parse('2026-10-07T12:17:00Z');
const phones = ['62994790340', '62991672674', '62981810202'];
const windows: CostWindow[] = phones.slice(1).map((telefone) => ({ telefone, instancia_id: 'a', ultima_msg_entrada_em: '2026-10-07T12:00:00Z' }));
describe('Meta cost estimates do not remove recipients', () => {
  test('three sends remain three with one billed and two free Utility', () => {
    const cost = estimateMetaCost(phones, ['a'], 'UTILITY', windows, now);
    expect(cost.total).toBe(3);
    expect(cost.cobrados).toBe(1);
    expect(cost.gratis).toBe(2);
  });
  test('another sender window does not guarantee free routing', () => {
    expect(estimateMetaCost(phones, ['a', 'b'], 'UTILITY', windows, now).gratis).toBe(0);
    expect(estimateMetaCost(phones, ['b'], 'UTILITY', windows, now).cobrados).toBe(3);
  });
  test('windows on all possible senders allow conservative free estimate', () => {
    const both = [...windows, ...windows.map((row) => ({ ...row, instancia_id: 'b' }))];
    expect(estimateMetaCost(phones, ['a', 'b'], 'UTILITY', both, now).gratis).toBe(2);
  });
  test('Marketing and Authentication remain billed inside the service window', () => {
    for (const category of ['MARKETING', 'AUTHENTICATION']) {
      expect(estimateMetaCost(phones, ['a'], category, windows, now).cobrados).toBe(3);
    }
  });
  test('expired or failed lookup never promises free Utility', () => {
    expect(estimateMetaCost(phones, ['a'], 'UTILITY', windows, now + 86_400_000).gratis).toBe(0);
    expect(estimateMetaCost(phones, ['a'], 'UTILITY', windows, now, true).cobrados).toBe(3);
  });
  test('preserved duplicate rows count as sends', () => {
    expect(estimateMetaCost([...phones, phones[0]], ['a'], 'UTILITY', windows, now).total).toBe(4);
  });
});