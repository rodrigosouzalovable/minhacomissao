import { assertEquals } from 'jsr:@std/assert';
import { idiomaClienteUsa, precisaReexplicarIdiomaUsa } from './vendas-usa.ts';

Deno.test('No entiendo identifica espanhol e exige reexplicação', () => {
  assertEquals(idiomaClienteUsa('No entiendo'), 'es');
  assertEquals(precisaReexplicarIdiomaUsa('No entiendo'), true);
});
Deno.test('pedido explícito de inglês prevalece sobre espanhol', () => {
  assertEquals(idiomaClienteUsa('No entiendo, in English please'), 'en');
});
Deno.test('espanhol solicitado prevalece sobre inglês', () => {
  assertEquals(idiomaClienteUsa('I do not understand, speak Spanish'), 'es');
});
Deno.test('mensagem ambígua mantém espanhol anterior', () => assertEquals(idiomaClienteUsa('ok', ['No entiendo']), 'es'));
Deno.test('sem evidência de idioma usa inglês para USA', () => assertEquals(idiomaClienteUsa('?'), 'en'));
Deno.test('português identifica idioma do cliente', () => assertEquals(idiomaClienteUsa('Não entendo'), 'pt'));
Deno.test('incompreensão em inglês exige reexplicação', () => assertEquals(precisaReexplicarIdiomaUsa("I don't understand"), true));
Deno.test('recusa em espanhol não reabre oferta', () => assertEquals(precisaReexplicarIdiomaUsa('No entiendo y no me interesa'), false));
Deno.test('opt-out em inglês não reabre oferta', () => assertEquals(precisaReexplicarIdiomaUsa('Stop, I do not understand'), false));