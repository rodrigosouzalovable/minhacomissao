import { describe, expect, test } from 'vitest';
import { calcularProposta, textoProposta } from './propostaSftp';

describe('proposta SFTP', () => {
  test('David: à vista pelo principal e 18x com +10%', () => {
    expect(calcularProposta(2101.8)).toEqual({ aVista: 2101.8, parcelas: 18, valorParcela: 128.44 });
  });
  test('parcela nunca abaixo de R$ 100', () => {
    const p = calcularProposta(500); // 550 / 5 = 110
    expect(p.parcelas).toBe(5);
    expect(p.valorParcela).toBeGreaterThanOrEqual(100);
  });
  test('sem parcelamento quando não cabe 2x de R$ 100', () => {
    expect(calcularProposta(150).parcelas).toBe(0);
    expect(textoProposta(150, 'odres')).not.toContain('parcele');
  });
  test('texto Odres no formato da Opção A', () => {
    expect(textoProposta(2101.8, 'odres')).toBe(
      '*Odres Cred referente ao seu telefone. Quite à vista por apenas R$ 2.101,80 ou parcele em até 18x de R$ 128,44. Pagando a 1ª no PIX seu aparelho desbloqueia na hora!*',
    );
  });
});

describe('proposta UME', () => {
  test('texto UME no formato da Opção 3 (final de ano)', () => {
    expect(textoProposta(2101.8, 'ume')).toBe(
      '*UME com condições especiais de final de ano. Quite à vista por R$ 2.101,80 ou parcele em até 18x de R$ 128,44. Pague a 1ª no PIX e volte a comprar a prazo!*',
    );
  });
  test('UME sem parcelamento quando não cabe 2x de R$ 100', () => {
    expect(textoProposta(150, 'ume')).toBe('*UME com condições especiais de final de ano. Quite à vista por R$ 150,00. Pague a 1ª no PIX e volte a comprar a prazo!*');
  });
});

test('negrito não duplica asteriscos já digitados', () => {
  expect(textoProposta(150, 'ume', '*Quite por R$ {avista}*')).toBe('*Quite por R$ 150,00*');
});

import { textoSemDivida } from './propostaSftp';
test('texto sem dívida por credor', () => {
  expect(textoSemDivida('odres')).toBe('*Odres Cred referente ao seu telefone. Pagando a 1ª no PIX seu aparelho desbloqueia na hora!*');
  expect(textoSemDivida('ume')).toBe('*UME com condições especiais de final de ano. Pague a 1ª no PIX e volte a comprar a prazo!*');
});
