// Remove only a leading Meta template marker, preserving escaped URL parameters.
export function resolveMetaButtonRedirect(path: string): string | null {
  const destination = path.replace(/^\/+/, "").replace(
    /^(?:\{\{\s*\d+\s*\}\}|%7B%7B(?:%20)*\d+(?:%20)*%7D%7D)/i,
    "",
  );
  const match = destination.match(/^(https?):\/+(.+)$/i);
  if (!match) return null;
  try {
    const url = new URL(`${match[1].toLowerCase()}://${match[2]}`);
    return url.hostname && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}