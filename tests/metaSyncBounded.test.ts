import { describe, expect, test } from 'bun:test';
import { fetchMetaSyncPage, runBoundedSync } from '../supabase/functions/_shared/meta-sync-bounded';

describe('bounded Meta sync', () => {
  test('reads each instance once, with at most four concurrent reads', async () => {
    let active = 0, peak = 0;
    const calls: number[] = [];
    const result = await runBoundedSync([1,2,3,4,5,6], async item => {
      calls.push(item); peak = Math.max(peak, ++active);
      await new Promise(resolve => setTimeout(resolve, 5));
      active--; return item;
    }, () => -1);
    expect(result).toEqual([1,2,3,4,5,6]); expect(calls.length).toBe(6); expect(peak).toBe(4);
  });
  test('isolates one failure', async () => {
    expect(await runBoundedSync([1,2,3], async item => {
      if (item === 2) throw new Error('unavailable'); return item;
    }, () => -1)).toEqual([1,-1,3]);
  });
  test('aborts current reads and prevents starting pending instances', async () => {
    const started: number[] = [];
    const result = await runBoundedSync([1,2,3], async (item, signal) => {
      started.push(item);
      await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
      return item;
    }, () => -1, 1, 10);
    expect(started).toEqual([1]); expect(result).toEqual([-1,-1,-1]);
  });
  test('aborts a hung Graph response body', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async (_url, init) => ({ json: () => new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }) })) as typeof fetch;
    try { await expect(fetchMetaSyncPage('https://graph.facebook.com/test', 'test', undefined, 10)).rejects.toThrow('aborted'); }
    finally { globalThis.fetch = original; }
  });
});