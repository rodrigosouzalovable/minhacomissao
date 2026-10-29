/**
 * Cache curto em memória para leituras repetidas entre telas.
 * Requisições simultâneas compartilham a mesma promise; erros não ficam guardados.
 */
type Entry = { at: number; promise: Promise<unknown> };
const store = new Map<string, Entry>();

export function cachedFetch<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.at < ttlMs) return hit.promise as Promise<T>;
  const promise = loader().catch((e) => {
    store.delete(key);
    throw e;
  });
  store.set(key, { at: now, promise });
  return promise;
}

export function cacheAge(key: string): number {
  const hit = store.get(key);
  return hit ? Date.now() - hit.at : Infinity;
}

export function invalidateCache(key: string) {
  store.delete(key);
}
