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
      'Odres Cred referente ao seu telefone. Quite à vista por apenas R$ 2.101,80 ou parcele em até 18x de R$ 128,44. Pagando a 1ª no PIX seu aparelho desbloqueia na hora!',
    );
  });
});
