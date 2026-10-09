import { isQualityOnlyHold } from './meta-messaging-health.ts';

type Input = {
  quality: unknown;
  readingConfirmed: boolean;
  previousHold: unknown;
  poolReleased: boolean;
  manuallyOutside: boolean;
  messagingRestricted: boolean;
};

/** Pool eligibility never establishes a quality transition or Meta unblock. */
export function releaseNotificationState(input: Input) {
  const raw = String(input.quality || '').trim().toUpperCase();
  const quality = input.readingConfirmed && ['GREEN', 'YELLOW', 'RED'].includes(raw)
    ? raw : 'UNKNOWN';
  const qualityConfirmed = quality !== 'UNKNOWN';
  return {
    quality,
    qualityConfirmed,
    greenConfirmed: qualityConfirmed && quality === 'GREEN',
    event: isQualityOnlyHold(input.previousHold) ? 'manual_quality_release' : 'restriction_release',
    poolAvailable: input.poolReleased && !input.manuallyOutside && !input.messagingRestricted,
    manuallyOutside: input.manuallyOutside,
    messagingRestricted: input.messagingRestricted,
  };
}

export function qualityReadingLine(quality: unknown, confirmed: boolean, checkedAt: string): string {
  const state = releaseNotificationState({ quality, readingConfirmed: confirmed, previousHold: null,
    poolReleased: false, manuallyOutside: false, messagingRestricted: false });
  const labels: Record<string, string> = { RED: 'baixa', YELLOW: 'média', GREEN: 'alta' };
  const value = state.qualityConfirmed
    ? `*${state.quality} (${labels[state.quality]})*` : '*não confirmada*';
  const timestamp = new Date(checkedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return `Qualidade consultada na Meta: ${value}.\nConsulta: ${timestamp} (BRT).`;
}