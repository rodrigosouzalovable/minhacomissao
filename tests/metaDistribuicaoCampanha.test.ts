import { describe, expect, it } from 'bun:test';
import { escolherPorMenorUso } from '../supabase/functions/_shared/meta-distribuicao-campanha';

const c = (id: string, quality: string) => ({ id, quality });

describe('distribuição igual na campanha', () => {
  it('escolhe o número com menos envios', () => {
    const uso = new Map([['a', 50], ['b', 10], ['c', 30]]);
    expect(escolherPorMenorUso([c('a', 'GREEN'), c('b', 'GREEN'), c('c', 'GREEN')], uso)?.id).toBe('b');
  });
  it('YELLOW/RED acima de 30% da média GREEN fica de fora', () => {
    const uso = new Map([['g1', 100], ['g2', 100], ['y', 30], ['r', 400]]);
    expect(escolherPorMenorUso([c('g1', 'GREEN'), c('g2', 'GREEN'), c('y', 'YELLOW'), c('r', 'RED')], uso, null, () => 0)?.id).toBe('g1');
  });
  it('YELLOW abaixo de 30% da média pode receber', () => {
    const uso = new Map([['g1', 100], ['y', 5]]);
    expect(escolherPorMenorUso([c('g1', 'GREEN'), c('y', 'YELLOW')], uso)?.id).toBe('y');
  });
  it('alterna com o último usado quando há empate', () => {
    const uso = new Map([['a', 10], ['b', 10]]);
    expect(escolherPorMenorUso([c('a', 'GREEN'), c('b', 'GREEN')], uso, 'a', () => 0)?.id).toBe('b');
  });
});
