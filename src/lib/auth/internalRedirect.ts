export function internalRedirect(value: string | null, origin: string): string | null {
  if (!value) return "/";
  // Reject encoded separators, controls and dot segments before URL normalization.
  if (!value.startsWith("/") || value.startsWith("//") ||
    /[\\\s\u0000-\u001f\u007f]/.test(value) || /%(?:2f|5c|2e|25|0[0-9a-f]|1[0-9a-f]|7f)/i.test(value) ||
    /(?:^|\/)\.{1,2}(?:\/|[?#]|$)/.test(value)) return null;
  const target = new URL(value, origin);
  return target.origin === origin ? target.pathname + target.search + target.hash : null;
}
