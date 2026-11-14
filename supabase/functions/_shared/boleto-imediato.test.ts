import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { vencimentoDiaUtil, ehPedidoBoletoImediato, credorBoletoAutomatico } from './boleto-imediato.ts';

Deno.test('sábado vence na segunda', () => assertEquals(vencimentoDiaUtil('2026-11-14'), '2026-11-16'));
Deno.test('domingo vence na segunda', () => assertEquals(vencimentoDiaUtil('2026-11-15'), '2026-11-16'));
Deno.test('dia útil vence no próprio dia', () => assertEquals(vencimentoDiaUtil('2026-11-17'), '2026-11-17'));
Deno.test('botão QUERO O BOLETO é pedido', () => assertEquals(ehPedidoBoletoImediato('QUERO O BOLETO'), true));
Deno.test('Odres Cred é atendido', () => assertEquals(credorBoletoAutomatico('Odres Cred'), true));
