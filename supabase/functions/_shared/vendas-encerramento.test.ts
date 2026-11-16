import { assertEquals } from 'jsr:@std/assert';
import { decidirParada, pareceRobo } from './vendas-encerramento.ts';
const base = { texto: 'Quanto custa?', entradasAnteriores: [], respostasIago: 0, ultimaSaidaMs: null, agoraMs: 1e9, interessado: false };
Deno.test('menu de robô para a conversa', () => assertEquals(pareceRobo('Digite 1 para cardápio'), true));
Deno.test('pergunta real continua', () => assertEquals(decidirParada(base), null));
Deno.test('4 respostas sem interesse param', () => assertEquals(decidirParada({ ...base, respostasIago: 4 }), 'sem_progresso'));
Deno.test('interessado não para por limite', () => assertEquals(decidirParada({ ...base, respostasIago: 6, interessado: true }), null));
Deno.test('resposta há menos de 2 min é pulada', () => assertEquals(decidirParada({ ...base, ultimaSaidaMs: 1e9 - 60_000 }), 'intervalo'));
