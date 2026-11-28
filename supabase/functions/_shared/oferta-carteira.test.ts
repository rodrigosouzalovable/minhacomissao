import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { calcularOferta, opcoesParcelas, textoCondicaoOdres, textoOferta } from './oferta-carteira.ts';

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

Deno.test('condição do modelo de desbloqueio Odres', () => {
  assertEquals(textoCondicaoOdres(150), 'à vista por R$ 150,00');
  assertEquals(textoCondicaoOdres(1573), 'à vista por R$ 1.573,00 ou parcelado: • 3x de R$ 576,77 • 7x de R$ 247,19 • 10x de R$ 173,03 • 14x de R$ 123,59 • 17x de R$ 101,78. As parcelas são mensais, não quinzenais');
  assertEquals(textoCondicaoOdres(350), 'à vista por R$ 350,00 ou parcelado: • 2x de R$ 192,50 • 3x de R$ 128,33. As parcelas são mensais, não quinzenais');
});

Deno.test('até 5 opções de parcelas, sempre incluindo o máximo', () => {
  assertEquals(opcoesParcelas(18), [4, 7, 11, 14, 18]);
  assertEquals(opcoesParcelas(6), [2, 3, 4, 5, 6]);
  assertEquals(opcoesParcelas(1), []);
});
