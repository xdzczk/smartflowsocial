/**
 * Client-safe URL helpers (no `env` / server-only imports).
 * Used by `seo.ts`, which ships to the browser via `root.tsx`.
 */
export function absoluteUrl(siteOrigin: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${siteOrigin}${p}`;
}
