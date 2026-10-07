import { describe, expect, test } from 'bun:test';
import { campaignImageForTemplate, campaignImagePathAllowed, validateCampaignImageFile, withCampaignImage } from '../supabase/functions/_shared/meta-campaign-image';

describe('Campaign-only image', () => {
  test('accepts JPG', () => expect(validateCampaignImageFile('image/jpeg', 100)).toBeNull());
  test('accepts PNG', () => expect(validateCampaignImageFile('image/png', 100)).toBeNull());
  test('allows exactly 5 MB, not more', () => { expect(validateCampaignImageFile('image/png', 5 * 1024 * 1024)).toBeNull(); expect(validateCampaignImageFile('image/png', 5 * 1024 * 1024 + 1)).not.toBeNull(); });
  test('rejects other formats', () => expect(validateCampaignImageFile('image/webp', 100)).not.toBeNull());
  test('rejects another owner', () => { expect(campaignImagePathAllowed('owner/campaign-images/a.jpg', 'other')).toBe(false); expect(campaignImagePathAllowed('owner/campaign-images/a.jpg', 'owner')).toBe(true); });
  test('does not apply to variants or campaigns without a choice', () => { const vars = { _campaign_image_path: 'a', _campaign_image_template: 'main|pt_BR' }; expect(campaignImageForTemplate(vars, { nome_template: 'variant', idioma: 'pt_BR' })).toBeNull(); expect(campaignImageForTemplate(undefined, { nome_template: 'main', idioma: 'pt_BR' })).toBeNull(); expect(campaignImageForTemplate(vars, { nome_template: 'main', idioma: 'pt_BR' })).toBe('a'); });
  test('preserves the original and drops old media IDs from the sending snapshot', () => { const original = { variaveis: { _header_format: 'IMAGE', _header_image_url: 'old', _header_media_ids: { inst: { id: 'old' } } } }; const sending = withCampaignImage(original, 'new'); expect(sending.variaveis._header_image_url).toBe('new'); expect(sending.variaveis._header_media_ids).toBeUndefined(); expect(original.variaveis._header_image_url).toBe('old'); expect(original.variaveis._header_media_ids.inst.id).toBe('old'); });
  test('rejects text-only templates even if an old format says IMAGE', () => expect(() => withCampaignImage({ variaveis: { _header_format: 'IMAGE', _components: [{ type: 'BODY', text: 'hi' }] } }, 'new')).toThrow());
});