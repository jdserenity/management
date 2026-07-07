/** Normalize client API base URL — bare host:port gets http:// (Tailscale); https:// kept as-is. */
export const normalizeApiUrl = (raw?: string): string | undefined => {
  const t = raw?.trim();
  if (!t) return undefined;
  const trimmed = t.replace(/\/$/, '');
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
};
