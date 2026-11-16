import { assertEquals } from 'jsr:@std/assert';
import { ehTemplateLembrete } from './lembrete-etiqueta.ts';
Deno.test('lembretes de pagamento vão para RODRIGO', () => {
  assertEquals(ehTemplateLembrete('novo_lembrete_envio_boleto_variavel'), true);
  assertEquals(ehTemplateLembrete('lembrete_pagamento'), true);
  assertEquals(ehTemplateLembrete('nova_parcela_vencida_2'), true);
});
Deno.test('campanhas de portal seguem o rodízio', () => {
  assertEquals(ehTemplateLembrete('odres_portal_de_negociacao'), false);
  assertEquals(ehTemplateLembrete(null), false);
});
