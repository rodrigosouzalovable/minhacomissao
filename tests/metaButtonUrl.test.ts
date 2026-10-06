import { describe, expect, test } from 'bun:test';
import { getMetaButtonLink, resolveButtonUrlParam, snapshotMetaButtonVars, validateMetaButtonLink } from '../supabase/functions/_shared/meta-button-url';

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
  test('saved changes A to B to C replace pending snapshots in both worker modes', () => {
    const pending = { vars: snapshotMetaButtonVars({}, 'https://old.example/A') };
    for (const link of ['https://w.app/czafpg', 'https://new.example/C?text=a%26b#info']) {
      const live = { _button_url: link, _button_url_live: true };
      expect(getMetaButtonLink(pending, live)).toBe(link);
      expect(getMetaButtonLink({ ...pending }, live)).toBe(link);
    }
  });
  test('an explicit test override wins even over a live saved link', () => {
    expect(getMetaButtonLink({ button_url: 'https://w.app/czafpg' }, {
      _button_url_live: true, _button_url: 'https://old.example/A',
    })).toBe('https://w.app/czafpg');
  });
  test('sent destinations remain frozen when a later saved destination changes', () => {
    const sent = { button_url: getMetaButtonLink({}, { _button_url_live: true, _button_url: 'https://w.app/czafpg' }) };
    expect(getMetaButtonLink(sent, { _button_url_live: true, _button_url: 'https://new.example/C' })).toBe('https://w.app/czafpg');
  });
  test('preserves parameters and fragments through the controlled redirect', () => {
    expect(resolveButtonUrlParam('https://meusacordos.com.br/{{1}}', 'https://w.app/czafpg?text=a%26b#info'))
      .toBe('https://w.app/czafpg?text=a%26b#info');
  });
  test('blocks unrelated fixed bases rather than concatenating a wrong URL', () => {
    expect(() => resolveButtonUrlParam('https://bvts.app/{{1}}', 'https://w.app/czafpg')).toThrow();
    expect(() => resolveButtonUrlParam('https://meusacordos.com.br/novomundo/{{1}}', 'https://w.app/czafpg')).toThrow();
    expect(() => resolveButtonUrlParam('https://example.com/{{1}}/extra', 'https://example.com/details')).toThrow();
  });
  test('rejects invalid or credential-bearing destinations', () => {
    for (const link of ['https://', 'javascript:alert(1)', 'https://user:pass@example.com', 'https://example.com/a b']) {
      expect(() => validateMetaButtonLink(link)).toThrow();
    }
  });
});