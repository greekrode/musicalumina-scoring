/**
 * Normalize a user-supplied URL for use in an anchor href.
 *
 * Registrations for online competitions store a `video_url` that may be entered
 * without a protocol (e.g. "youtu.be/abc"). This prepends `https://` when no
 * protocol is present and treats blank/whitespace values as "no URL".
 */
export function normalizeExternalUrl(
  url?: string | null
): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `https://${trimmed}`;
}

/**
 * Normalize a repertoire PDF URL. Registrations store `song_pdf_url` as a text
 * array (occasionally a bare string), so this picks the first entry and applies
 * {@link normalizeExternalUrl}.
 */
export function normalizeRepertoireUrl(
  value?: string | string[] | null
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return normalizeExternalUrl(raw);
}
