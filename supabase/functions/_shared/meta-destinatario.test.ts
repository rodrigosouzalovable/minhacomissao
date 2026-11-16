import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { telefoneMeta } from './meta-destinatario.ts';
Deno.test('número dos EUA sem + não recebe 55', () => assertEquals(telefoneMeta('14079552318'), '14079552318'));
Deno.test('celular brasileiro DDD 11 continua com 55', () => assertEquals(telefoneMeta('11987654321'), '5511987654321'));
