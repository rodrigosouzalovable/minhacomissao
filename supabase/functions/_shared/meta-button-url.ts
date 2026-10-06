/** Explicit manual overrides win; live saved destinations replace queued snapshots. */
export function getMetaButtonLink(
  cliente: { button_url?: unknown; vars?: Record<string, unknown> },
  templateVars?: Record<string, unknown> | null,
): string {
  const liveLink = templateVars?._button_url_live === true ? templateVars._button_url : undefined;
  return String(cliente.button_url || liveLink || cliente.vars?._button_url || templateVars?._button_url || '').trim();
}

export function validateMetaButtonLink(link: string): string {
  const value = link.trim();
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.hostname && !url.username && !url.password &&
      !/[\s\\\u0000-\u001f]/.test(value) && !/\{\{/.test(value)) return value;
  } catch { /* invalid URL */ }
  throw new Error('Link do botão inválido: informe um endereço HTTPS completo, sem espaços ou credenciais.');
}

export function resolveButtonUrlParam(registeredUrl: string, fullLink: string): string {
  const link = validateMetaButtonLink(fullLink);
  const match = registeredUrl.match(/^(.*?)\{\{\s*\d+\s*\}\}$/);
  if (!match || /\{\{/.test(match[1])) throw new Error('A URL dinâmica registrada na Meta não permite preservar este destino.');
  const base = match[1];
  if (base && link.startsWith(base)) {
    const suffix = link.slice(base.length);
    if (suffix) return suffix;
  }
  // Only our root redirect accepts a complete external destination as the suffix.
  if (/^https:\/\/(?:www\.)?meusacordos\.com\.br\/(?:%7B%7B(?:%20)*\d+(?:%20)*%7D%7D)?$/i.test(base)) return link;
  throw new Error('O link informado não é compatível com a URL fixa deste modelo na Meta. Use um modelo com redirecionamento ou ajuste a URL do modelo.');
}

export function snapshotMetaButtonVars(vars: Record<string, string> | undefined, link: string): Record<string, string> {
  return link ? { ...vars, _button_url: link } : { ...vars };
}