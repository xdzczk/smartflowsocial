/**
 * Lowercase haystack for filtering drafts by global / shared search term.
 */

function safeStringifyMeta(meta: unknown): string {
  if (meta == null) return "";
  try {
    return JSON.stringify(meta).toLowerCase();
  } catch {
    return "";
  }
}

export function buildShortDraftSearchHaystack(post: {
  caption?: string | null;
  content?: string | null;
  draftMeta?: unknown;
}): string {
  const cap = (post.caption ?? "").toLowerCase();
  const body = (post.content ?? "").toLowerCase();
  const meta = safeStringifyMeta(post.draftMeta);
  return `${cap} ${body} ${meta}`;
}

export function matchesDraftSearch(haystack: string, term: string): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  return haystack.includes(q);
}
