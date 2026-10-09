import { describe, expect, test } from 'bun:test';
import { inboxPhoneSearch, inboxPhoneSearchArgs } from '../src/lib/metaInboxPhoneSearch';

describe('Busca global autorizada por telefone no Inbox', () => {
  test('últimos quatro dígitos e telefone formatado encontram o mesmo sufixo', () => {
    expect(inboxPhoneSearch('9476')).toBe('9476');
    expect(inboxPhoneSearch('+55 (62) 99632-9476')).toBe('96329476');
    expect(inboxPhoneSearch('+55 (62) 9632-9476')).toBe('96329476');
  });
  test('nome de instância e termos curtos não ativam busca global de telefone', () => {
    expect(inboxPhoneSearch('Novo Mundo 3144')).toBeNull();
    expect(inboxPhoneSearch('947')).toBeNull();
    expect(inboxPhoneSearch('')).toBeNull();
  });
  test('consulta não restringe caixa, instância, etiqueta, arquivadas ou leitura', () => {
    expect(inboxPhoneSearchArgs('9476', 200)).toEqual({ p_suffix: '9476', p_limit: 200 });
  });
  test('final 1649 é encontrado com ou sem nono dígito', () => {
    expect(inboxPhoneSearch('1649')).toBe('1649');
    expect(inboxPhoneSearch('98711649')).toBe('98711649');
    expect(inboxPhoneSearch('+55 (61) 9871-1649')).toBe('98711649');
    expect(inboxPhoneSearch('+55 (61) 99871-1649')).toBe('98711649');
  });
  test('valida sufixos e limita paginação', () => {
    expect(() => inboxPhoneSearchArgs('%1649', 200)).toThrow();
    expect(() => inboxPhoneSearchArgs('164', 200)).toThrow();
    expect(inboxPhoneSearchArgs('1649', 9999).p_limit).toBe(2000);
  });
});
