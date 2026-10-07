import { describe, expect, test } from 'bun:test';
import { getTemplateVariables, initialTemplateValues, templateValuesFor, templateVariablesFilled, dynamicTemplateButtons, templateButtonError } from '../src/lib/metaTemplateVariables';

describe('Required Inbox Meta template values', () => {
  test('no variables need no values', () => {
    expect(getTemplateVariables({ body_text: 'Olá!' })).toEqual([]);
    expect(templateVariablesFilled([], {})).toBe(true);
  });
  test('numeric variables are sorted and deduplicated and all required', () => {
    const vars = getTemplateVariables({ body_text: '{{10}} {{2}} {{1}} {{2}}' });
    expect(vars.map(v => v.key)).toEqual(['1', '2', '10']);
    expect(templateVariablesFilled(vars, { 'body:1': 'Fabiola', 'body:2': '10/10' })).toBe(false);
    expect(templateVariablesFilled(vars, { 'body:1': 'Fabiola', 'body:2': '10/10', 'body:10': 'R$ 100' })).toBe(true);
  });
  test('named variables reject whitespace and serialize separately', () => {
    const vars = getTemplateVariables({ body_text: '{{nome}} {{vencimento}} {{nome}}' });
    expect(vars.map(v => v.key)).toEqual(['nome', 'vencimento']);
    expect(templateVariablesFilled(vars, { 'body:nome': 'Fabiola', 'body:vencimento': '  ' })).toBe(false);
    expect(templateValuesFor(vars, { 'body:nome': ' Fabiola ', 'body:vencimento': '10/10' }, 'body')).toEqual({ nome: 'Fabiola', vencimento: '10/10' });
  });
  test('header and body sharing a number remain independent', () => {
    const vars = getTemplateVariables({ variaveis: { _components: [
      { type: 'HEADER', format: 'TEXT', text: '{{1}}' }, { type: 'BODY', text: '{{1}} {{2}}' },
    ] } });
    expect(vars.map(v => v.id)).toEqual(['header:1', 'body:1', 'body:2']);
    const values = { 'header:1': 'Aviso', 'body:1': 'Fabiola', 'body:2': '10/10' };
    expect(templateValuesFor(vars, values, 'header')).toEqual({ '1': 'Aviso' });
    expect(templateValuesFor(vars, values, 'body')).toEqual({ '1': 'Fabiola', '2': '10/10' });
  });
  test('only identified name fields receive suggestions; others reset empty', () => {
    const vars = getTemplateVariables({ body_text: '{{1}} {{2}} {{3}}', variaveis: { '1': '{nome}', '2': '{vencimento}', '3': '{saldo}' } });
    expect(initialTemplateValues(vars, 'Fabiola Silva')).toEqual({ 'body:1': 'Fabiola', 'body:2': '', 'body:3': '' });
    expect(initialTemplateValues(getTemplateVariables({ body_text: '{{1}}' }), 'Fabiola')).toEqual({ 'body:1': '' });
  });
  test('dynamic links are mandatory HTTPS and preserve full destination', () => {
    const template = { variaveis: { _components: [{ type: 'BUTTONS', buttons: [
      { type: 'URL', text: 'Detalhes', url: 'https://meusacordos.com.br/{{1}}' },
      { type: 'URL', text: 'Site', url: 'https://meusacordos.com.br/' },
    ] }] } };
    expect(dynamicTemplateButtons(template)).toHaveLength(1);
    expect(templateButtonError(template, '')).not.toBe('');
    expect(templateButtonError(template, 'http://example.com/')).not.toBe('');
    expect(templateButtonError(template, 'https://example.com/page?a=1#details')).toBe('');
    expect(templateButtonError({ body_text: 'Sem botão' }, '')).toBe('');
  });
});
