/**
 * Dynamic import wrapper resilient to transient chunk-load failures
 * (dev-server restart / new deploy invalidating old chunk URLs).
 * Retries once after a short delay, then forces a single full reload.
 */
export function retryImport<T>(factory: () => Promise<T>): Promise<T> {
  return factory().catch(async (err) => {
    await new Promise((r) => setTimeout(r, 600));
    try {
      return await factory();
    } catch (err2) {
      const KEY = 'chunk-reload-once';
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, '1');
        window.location.reload();
        // Keep the promise pending while the page reloads.
        return await new Promise<T>(() => {});
      }
      throw err2 ?? err;
    }
  });
}
