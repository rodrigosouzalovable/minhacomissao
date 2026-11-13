import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { calcularOferta, textoOferta } from './oferta-carteira.ts';

Deno.test('à vista é o principal e parcelado é principal +10% em até 17x de R$ 101,78', () => {
  assertEquals(calcularOferta(1573), { avista: 1573, parcelas: 17, valorParcela: 101.78 });
});

Deno.test('parcela nunca fica abaixo de R$ 100: R$ 205,80 vira 2x de R$ 113,19', () => {
  assertEquals(calcularOferta(205.8), { avista: 205.8, parcelas: 2, valorParcela: 113.19 });
});

Deno.test('máximo de 18 parcelas mesmo com dívida alta', () => {
  assertEquals(calcularOferta(5000).parcelas, 18);
});

Deno.test('abaixo de R$ 181,82 só oferece à vista', () => {
  assertEquals(calcularOferta(150).parcelas, 1);
  assertEquals(textoOferta('odres_cred', 150, 11), '*Odres Cred referente ao seu telefone. Quite à vista por apenas R$ 150,00. Pagando a 1ª no PIX seu aparelho desbloqueia na hora!*');
});

Deno.test('texto Odres igual ao usado nas campanhas manuais', () => {
  assertEquals(textoOferta('odres_cred', 1573, 11), '*Odres Cred referente ao seu telefone. Quite à vista por apenas R$ 1.573,00 ou parcele em até 17x de R$ 101,78 POR MÊS. Pagando a 1ª no PIX seu aparelho desbloqueia na hora!*');
});
