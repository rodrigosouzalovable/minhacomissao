/** Preserve the server's refusal without consuming the original response. */
export async function invokeErrorMessage(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : 'Falha ao chamar o serviço de envio';
  const context = (error as { context?: unknown } | null)?.context;
  if (!(context instanceof Response)) return fallback;
  try {
    const payload: unknown = await context.clone().json();
    if (payload && typeof payload === 'object') {
      const body = payload as { error?: unknown; message?: unknown };
      if (typeof body.error === 'string' && body.error.trim()) return body.error;
      if (typeof body.message === 'string' && body.message.trim()) return body.message;
    }
  } catch {
    // Non-JSON gateway errors must not expose an HTML page in the Inbox.
  }
  return fallback;
}