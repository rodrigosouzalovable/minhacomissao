import { describe, expect, test } from 'bun:test';
import { canReadCampaign, shouldRefreshCampaign } from '../src/lib/metaCampaignLive';
describe('Campanhas compartilhadas ao vivo', () => {
  test('Guilherme lê somente a campanha concedida', () => {
    expect(canReadCampaign('Rodrigo', 'Guilherme', ['dib'], 'dib')).toBe(true);
    expect(canReadCampaign('Rodrigo', 'Guilherme', ['dib'], 'outra')).toBe(false);
    expect(canReadCampaign('Rodrigo', 'terceiro', [], 'dib')).toBe(false);
  });
  test('segundo plano suspende atualizações', () => {
    expect(shouldRefreshCampaign(false, 15000, 2000)).toBe(false);
    expect(shouldRefreshCampaign(true, 15000, 2000)).toBe(true);
    expect(shouldRefreshCampaign(true, 1000, 2000)).toBe(false);
  });
});