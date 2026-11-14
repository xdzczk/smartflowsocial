const DEFAULT_FALLBACK = "/dashboard";

function hasControlCharacter(path: string): boolean {
  for (let index = 0; index < path.length; index += 1) {
    const code = path.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

/**
 * Accepts an in-app path. Rejects absolute URLs and the backslash and
 * protocol-relative forms that browsers can treat as a different host.
 */
export function safeInternalPath(
  value: unknown,
  fallback = DEFAULT_FALLBACK
): string {
  if (typeof value !== "string") return fallback;
  const path = value.trim();
  if (path.length === 0 || path.length > 2048) return fallback;
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//") || path.startsWith("/\\")) return fallback;
  if (path.includes("\\") || hasControlCharacter(path)) return fallback;
  if (/%5c/i.test(path) || /^\/(?:%2f)+/i.test(path)) return fallback;
  return path;
}
