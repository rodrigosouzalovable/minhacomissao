import { describe, expect, test } from 'bun:test';
import { getMetaButtonLink, resolveButtonUrlParam, snapshotMetaButtonVars } from '../supabase/functions/_shared/meta-button-url';

describe('Campaign dynamic button destination', () => {
  test('preserves the selected WhatsApp link despite an old instance default', () => {
    const vars = snapshotMetaButtonVars({ '1': 'Rodrigo' }, 'https://w.app/czafpg');
    expect(getMetaButtonLink({ vars }, { _button_url: 'https://meusacordos.com.br/novomundo' })).toBe('https://w.app/czafpg');
    expect(vars['1']).toBe('Rodrigo');
  });
  test('sends the complete external destination through the legacy redirect base', () => {
    expect(resolveButtonUrlParam('https://meusacordos.com.br/%7B%7B1%7D%7D{{1}}', 'https://w.app/czafpg')).toBe('https://w.app/czafpg');
  });
  test('keeps suffix parameters for matching fixed bases', () => {
    expect(resolveButtonUrlParam('https://example.com/{{1}}', 'https://example.com/details?a=1')).toBe('details?a=1');
  });
  test('manual send overrides the campaign snapshot; legacy sends retain defaults', () => {
    expect(getMetaButtonLink({ button_url: 'https://w.app/czafpg', vars: { _button_url: 'https://old.example' } })).toBe('https://w.app/czafpg');
    expect(getMetaButtonLink({}, { _button_url: 'https://fallback.example' })).toBe('https://fallback.example');
  });
});