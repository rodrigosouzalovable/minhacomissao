import { describe, expect, it } from 'bun:test';
import { releaseNotificationState } from '../supabase/functions/_shared/meta-health-notification';

const base = { quality: 'RED', readingConfirmed: true,
  previousHold: 'Restrição de qualidade/reputação confirmada pela Meta',
  poolReleased: true, manuallyOutside: false, messagingRestricted: false };

describe('Meta quality is independent of release', () => {
  it('RED released manually remains RED, not GREEN or a Meta unblock', () => {
    const result = releaseNotificationState(base);
    expect(result.quality).toBe('RED');
    expect(result.greenConfirmed).toBe(false);
    expect(result.event).toBe('manual_quality_release');
    expect(result.poolAvailable).toBe(true);
  });
  it('YELLOW released manually remains YELLOW', () => {
    const result = releaseNotificationState({ ...base, quality: 'YELLOW' });
    expect(result.quality).toBe('YELLOW');
    expect(result.greenConfirmed).toBe(false);
  });
  it('confirmed GREEN is high quality independently of pool eligibility', () => {
    const result = releaseNotificationState({ ...base, quality: 'GREEN', poolReleased: false });
    expect(result.greenConfirmed).toBe(true);
    expect(result.poolAvailable).toBe(false);
  });
  it('unknown reading cannot announce improvement', () => {
    expect(releaseNotificationState({ ...base, quality: 'UNKNOWN' }).qualityConfirmed).toBe(false);
  });
  it('failed reading cannot confirm even a GREEN value', () => {
    const result = releaseNotificationState({ ...base, quality: 'GREEN', readingConfirmed: false });
    expect(result.quality).toBe('UNKNOWN');
    expect(result.greenConfirmed).toBe(false);
  });
  it('removed account block can retain low quality', () => {
    const result = releaseNotificationState({ ...base, previousHold: 'Business account locked #131031' });
    expect(result.event).toBe('restriction_release');
    expect(result.quality).toBe('RED');
    expect(result.greenConfirmed).toBe(false);
  });
  it('manual pool exclusion remains unavailable', () => {
    expect(releaseNotificationState({ ...base, manuallyOutside: true }).poolAvailable).toBe(false);
  });
  it('simultaneous messaging restriction remains unavailable', () => {
    expect(releaseNotificationState({ ...base, messagingRestricted: true }).poolAvailable).toBe(false);
  });
});