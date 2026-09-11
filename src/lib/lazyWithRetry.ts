const CHUNK_RELOAD_KEY = 'chunk-reload-state';

type ChunkReloadState = {
  signature: string;
  attemptedAt: number;
};

function errorSignature(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const asset = message.match(/https?:\/\/[^\s]+\/assets\/[^\s]+\.js/)?.[0];
  return asset || message.slice(0, 300);
}

function readReloadState(): ChunkReloadState | null {
  try {
    const value = sessionStorage.getItem(CHUNK_RELOAD_KEY);
    return value ? JSON.parse(value) as ChunkReloadState : null;
  } catch {
    return null;
  }
}

function forceFreshReload(signature: string): void {
  sessionStorage.setItem(CHUNK_RELOAD_KEY, JSON.stringify({
    signature,
    attemptedAt: Date.now(),
  } satisfies ChunkReloadState));

  const url = new URL(window.location.href);
  url.searchParams.set('__chunk_reload', Date.now().toString());
  window.location.replace(url.toString());
}

/**
 * Dynamic import wrapper resilient to deploys that invalidate old chunk URLs.
 * A failed chunk gets one cache-busting page reload. The guard is tied to the
 * failed asset instead of permanently disabling recovery for the whole tab.
 */
export function retryImport<T>(factory: () => Promise<T>): Promise<T> {
  return factory().then((module) => {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    return module;
  }).catch(async (err) => {
    await new Promise((r) => setTimeout(r, 600));
    try {
      const module = await factory();
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      return module;
    } catch (err2) {
      const signature = errorSignature(err2 ?? err);
      const previous = readReloadState();
      const recentlyRetriedSameAsset = previous?.signature === signature
        && Date.now() - previous.attemptedAt < 30_000;

      if (!recentlyRetriedSameAsset) {
        forceFreshReload(signature);
        // Keep the promise pending while the page reloads.
        return await new Promise<T>(() => {});
      }
      throw err2 ?? err;
    }
  });
}
