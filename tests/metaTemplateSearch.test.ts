import { expect, test } from 'bun:test';
import { matchesTemplateSearch } from '../src/lib/metaTemplateSearch';
const template = { nome: 'novo_lembrete', descricao: 'Olá {{1}}, seu boleto da {{2}} vence em {{3}}. Solicite o documento.' };
test('Envio Meta finds a word only in the full body', () => { expect(matchesTemplateSearch(template, 'documento', true)).toBe(true); expect(matchesTemplateSearch(template, 'documento', false)).toBe(false); });
test('Search ignores accents and case and keeps name matching', () => { expect(matchesTemplateSearch(template, 'OLA', true)).toBe(true); expect(matchesTemplateSearch(template, 'NOVO')).toBe(true); expect(matchesTemplateSearch(template, 'inexistente', true)).toBe(false); });