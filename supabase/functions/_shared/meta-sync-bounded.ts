// One cancellation deadline, no retries or extra jobs.
export async function runBoundedSync<T, R>(items: T[], process: (item: T, signal: AbortSignal) => Promise<R>, onFailure: (item: T, error: unknown) => R, concurrency = 4, timeoutMs = 90_000): Promise<R[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const results: R[] = new Array(items.length);
  let cursor = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        const item = items[index];
        try {
          controller.signal.throwIfAborted();
          results[index] = await process(item, controller.signal);
        } catch (error) { results[index] = onFailure(item, error); }
      }
    }));
    return results;
  } finally { clearTimeout(timer); }
}

export async function fetchMetaSyncPage(url: string, token: string, parent?: AbortSignal, timeoutMs = 12_000) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (parent?.aborted) controller.abort();
  parent?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
    const payload = await response.json();
    return { response, payload };
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener('abort', abort);
  }
}