/** Campaign snapshots override mutable per-instance template defaults. */
export function getMetaButtonLink(
  cliente: { button_url?: unknown; vars?: Record<string, unknown> },
  templateVars?: Record<string, unknown> | null,
): string {
  return String(cliente.button_url || cliente.vars?._button_url || templateVars?._button_url || '').trim();
}

export function resolveButtonUrlParam(registeredUrl: string, fullLink: string): string {
  const base = registeredUrl.replace(/\{\{\s*\d+\s*\}\}.*$/, '');
  if (base && fullLink.startsWith(base)) {
    const suffix = fullLink.slice(base.length);
    if (suffix) return suffix;
  }
  return fullLink;
}

export function snapshotMetaButtonVars(vars: Record<string, string> | undefined, link: string): Record<string, string> {
  return link ? { ...vars, _button_url: link } : { ...vars };
}