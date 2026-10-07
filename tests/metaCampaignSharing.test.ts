import { describe, expect, test } from 'bun:test';
import { canManageCampaign } from '../supabase/functions/_shared/meta-campaign-access';
describe('Compartilhamento somente visualização', () => {
  test('somente o dono pode controlar ou compartilhar a campanha', () => {
    expect(canManageCampaign('owner', 'owner')).toBe(true);
    expect(canManageCampaign('owner', 'viewer')).toBe(false);
    expect(canManageCampaign('owner', 'admin-observer')).toBe(false);
  });
  test('sessão ausente nunca concede comandos', () => {
    expect(canManageCampaign('owner', undefined)).toBe(false);
    expect(canManageCampaign(undefined, undefined)).toBe(false);
  });
});