import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { ehPedidoAtendenteHumano } from '../_shared/iago.ts';

Deno.test('detecta pedidos explícitos de atendimento humano', () => {
  const pedidos = [
    'Quero falar com humano',
    'Pode me passar para um atendente?',
    'Prefiro conversar com uma pessoa de verdade',
    'chama alguém da equipe por favor',
    'Preciso falar com o responsável',
  ];
  for (const texto of pedidos) assertEquals(ehPedidoAtendenteHumano(texto), true, texto);
});

Deno.test('não confunde conversa comum com pedido de humano', () => {
  const comuns = [
    'Como posso pagar?',
    'Quero falar sobre meu acordo',
    'A atendente falou comigo ontem',
    'Pode explicar novamente?',
  ];
  for (const texto of comuns) assertEquals(ehPedidoAtendenteHumano(texto), false, texto);
});