import { describe, expect, test } from 'bun:test';
import { metaFirstRowIsHeader, metaHeaderVariable, metaHeaderMappingIssues, metaImportDataRows } from '../src/lib/metaImportHeader';
import { conferirContatosNovoMundo } from '../src/lib/novoMundoContatos';

describe('Cabeçalhos explícitos das importações', () => {
  test('Telefone, {{1}}, {{2}} exclui cabeçalho e preserva B/C', () => {
    const rows = [['Telefone', '{{1}}', '{{2}}'], ['98988105168', 'tudo bem?', 'Raynara Costa']];
    expect(metaFirstRowIsHeader(rows)).toBe(true);
    expect(metaImportDataRows(rows, true)).toEqual([rows[1]]);
    expect(rows[0].map(metaHeaderVariable)).toEqual([null, '1', '2']);
    const result = conferirContatosNovoMundo(rows);
    expect(result.headers).toEqual(rows[0]);
    expect(result.contatos).toEqual([{ telefone: '5598988105168', var1: 'tudo bem?', var2: 'Raynara Costa' }]);
  });
  test('espaços, acentos e variáveis adicionais identificados sem inferência', () => {
    expect([' {{ 1 }} ', 'Variável 2', '{{3}}', 'Nome {{1}}'].map(metaHeaderVariable)).toEqual(['1', '2', '3', null]);
    expect(metaHeaderMappingIssues(['Telefone', '{{1}}', '{{2}}', '{{3}}'], ['telefone', 'tplvar:1', 'tplvar:2', 'tplvar:3'], ['1', '2', '3'])).toEqual([]);
  });
  test('variável desconhecida e obrigatória ausente precisam revisão', () => {
    expect(metaHeaderMappingIssues(['Telefone', '{{1}}', '{{9}}'], ['telefone', 'tplvar:1', 'ignore'], ['1', '2'])).toHaveLength(2);
  });
  test('cabeçalho duplicado não pode ser ignorado silenciosamente', () => {
    expect(metaHeaderMappingIssues(['Telefone', '{{1}}', '{{1}}'], ['telefone', 'tplvar:1', 'ignore'], ['1', '2'])).toHaveLength(2);
    expect(metaHeaderMappingIssues(['Telefone', '{{1}}', '{{1}}'], ['telefone', 'tplvar:1', 'tplvar:2'], ['1', '2'])).toEqual([]);
  });
  test('Novo Mundo rejeita variáveis duplicadas ou trocadas', () => {
    for (const header of [['Telefone', '{{1}}', '{{1}}'], ['Telefone', '{{2}}', '{{1}}']]) {
      expect(() => conferirContatosNovoMundo([header, ['98988105168', 'Oi', 'Nome']])).toThrow('Revise o cabeçalho');
    }
  });
  test('Novo Mundo aceita títulos numerados e preserva primeiro cliente sem cabeçalho', () => {
    const row = ['98988105168', 'Oi', 'Nome'];
    expect(conferirContatosNovoMundo([['Telefone', 'Variável 1', 'Variável 2'], row]).total).toBe(1);
    expect(conferirContatosNovoMundo([row]).contatos[0]?.var1).toBe('Oi');
    expect(conferirContatosNovoMundo([row]).headers).toBeNull();
  });
});