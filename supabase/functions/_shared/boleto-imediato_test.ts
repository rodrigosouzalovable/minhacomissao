import { assert, assertFalse } from 'jsr:@std/assert';
import { ehBotaoQueroBoleto, valorCompativelComParcela } from './boleto-imediato.ts';
Deno.test('texto livre com pix não dispara', () => { assertFalse(ehBotaoQueroBoleto('me manda o pix')); assertFalse(ehBotaoQueroBoleto('18 vezes de 169, boleto?')); });
Deno.test('botão QUERO O BOLETO dispara', () => assert(ehBotaoQueroBoleto('QUERO O BOLETO')));
Deno.test('dívida total acima da parcela bloqueia', () => assertFalse(valorCompativelComParcela(30128.51, 169)));
Deno.test('parcela com juros passa', () => assert(valorCompativelComParcela(185, 169)));
