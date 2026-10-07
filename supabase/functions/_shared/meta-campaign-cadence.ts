export function remainingDelay(startedAt: number, intervalMs: number, now: number): number {
  return Math.max(0, startedAt + Math.max(1000, intervalMs) - now);
}

export function retryDelay(body: { retry_after_ms?: number; error?: string }, fallback = 30_000): number {
  if (Number.isFinite(body.retry_after_ms) && Number(body.retry_after_ms) > 0) return Math.max(1000, Number(body.retry_after_ms));
  const ms = String(body.error || '').match(/retry\s+after\s+(\d+)\s*ms/i);
  const sec = String(body.error || '').match(/retry\s+after\s+(\d+)\s*s(?:ec)?/i);
  return Math.max(1000, ms ? Number(ms[1]) : sec ? Number(sec[1]) * 1000 : fallback);
}