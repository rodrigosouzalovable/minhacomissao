import { describe, expect, test } from 'bun:test';
import { conferirContatosNovoMundo, capacidadeNovoMundo, telefoneNovoMundo } from '../supabase/functions/_shared/novo-mundo-contatos-rules';
describe('Base consentida Novo Mundo', () => {
  const row = ['98988105168', 'tudo bem?', 'Raynara Aragao Costa'];
  test('até 5000 dados além do cabeçalho', () => {
    expect(conferirContatosNovoMundo([['Telefone', '{{1}}', '{{2}}'], ...Array.from({length:5000}, () => row)]).total).toBe(5000);
    expect(() => conferirContatosNovoMundo(Array.from({length:5001}, () => row))).toThrow();
  });
  test('preserva B/C sem saudação ou nome inventados', () => {
    expect(conferirContatosNovoMundo([['98988105168', 'como vai,', '  Raynara Costa  ']]).contatos[0]).toEqual({telefone:'5598988105168',var1:'como vai,',var2:'  Raynara Costa  '});
  });
  test('sem cabeçalho não perde primeiro cliente', () => expect(conferirContatosNovoMundo([row]).contatos).toHaveLength(1));
  test('dedup por sufixo e conflito não silencioso', () => {
    const r = conferirContatosNovoMundo([row, ['5598988105168', 'oi', row[2]]]);
    expect(r.duplicados).toBe(1); expect(r.conflitos).toEqual(['88105168']);
  });
  test('DDD inválido e internacional ignorados', () => {
    expect(telefoneNovoMundo('00988105168')).toBeNull();
    expect(telefoneNovoMundo('+1 555-945-7201')).toBeNull();
    expect(conferirContatosNovoMundo([['98988105168','','Nome'],row]).invalidos).toBe(1);
  });
  test('DDDs distintos com mesmo final não são conflito de variáveis', () => {
    const r = conferirContatosNovoMundo([
      ['Telefone', '{{1}}', '{{2}}'],
      ['92995088757', 'tudo bem?', 'Cliente A'],
      ['99995088757', 'oi', 'Cliente B'],
      ['93991507594', 'tudo bem?', 'Cliente C'],
      ['98991507594', 'oi', 'Cliente D'],
    ]);
    expect(r.conflitos).toEqual([]);
    expect(r.coincidencias).toEqual([
      { telefone: '5599995088757', mantido: '5592995088757', linha: 3 },
      { telefone: '5598991507594', mantido: '5593991507594', linha: 5 },
    ]);
    expect(r.contatos.map(c => c.var2)).toEqual(['Cliente A', 'Cliente C']);
    expect(r.duplicados - r.coincidencias.length).toBe(0);
  });
  test('estoque nunca excede 5000 nem sobrescreve saldo', () => {
    expect(capacidadeNovoMundo(4900,100)).toBe(true); expect(capacidadeNovoMundo(4900,101)).toBe(false);
  });
});