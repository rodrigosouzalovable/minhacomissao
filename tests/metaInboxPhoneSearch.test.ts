import { describe, expect, test } from 'bun:test';
import { inboxPhoneSearch, inboxPhoneSearchQuery } from '../src/lib/metaInboxPhoneSearch';

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
  test('consulta paginada não restringe caixa, instância, etiqueta, arquivadas ou leitura', () => {
    const calls: unknown[] = [];
    const query = {
      like(column: string, pattern: string) { calls.push(['like', column, pattern]); return this; },
      order(column: string, options: unknown) { calls.push(['order', column, options]); return this; },
      limit(count: number) { calls.push(['limit', count]); return this; },
    };
    inboxPhoneSearchQuery(query, '9476', 200);
    expect(calls).toEqual([
      ['like', 'telefone', '%9476'],
      ['order', 'ultima_mensagem_em', { ascending: false, nullsFirst: false }],
      ['limit', 200],
    ]);
  });
});