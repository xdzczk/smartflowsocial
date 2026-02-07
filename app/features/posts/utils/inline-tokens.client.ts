/**
 * Inline attachment tokens in composer content.
 * Format: [attach:localId]
 */

import {
  COMPOSER_ATTACH_TOKEN_PREFIX,
  COMPOSER_ATTACH_TOKEN_SUFFIX,
} from "../types";

export const ATTACH_TOKEN_REGEX = /\[attach:([^\]]+)\]/g;

/**
 * Insert a token at the end of content (simplest: append).
 * For "at cursor" we'd need a ref and selection; caller can use this or implement cursor insert.
 */
export function appendToken(content: string, localId: string): string {
  const token = `${COMPOSER_ATTACH_TOKEN_PREFIX}${localId}${COMPOSER_ATTACH_TOKEN_SUFFIX}`;
  const trimmed = content.trimEnd();
  return trimmed ? `${trimmed}\n\n${token}` : token;
}

/**
 * Insert token at cursor in a textarea (mutates selection).
 * Returns new content and new cursor offset.
 */
export function insertTokenAtCursor(
  content: string,
  localId: string,
  cursorOffset: number
): { newContent: string; newOffset: number } {
  const token = `${COMPOSER_ATTACH_TOKEN_PREFIX}${localId}${COMPOSER_ATTACH_TOKEN_SUFFIX}`;
  const before = content.slice(0, cursorOffset);
  const after = content.slice(cursorOffset);
  const newContent = before + token + (after ? "\n" + after : "");
  const newOffset = before.length + token.length + (after ? 1 : 0);
  return { newContent, newOffset };
}

/**
 * Remove a token for the given localId from content.
 */
export function removeToken(content: string, localId: string): string {
  const token = `${COMPOSER_ATTACH_TOKEN_PREFIX}${localId}${COMPOSER_ATTACH_TOKEN_SUFFIX}`;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return content.replace(new RegExp(escaped + "\\n?", "g"), "").trim();
}

/**
 * Extract localIds from content in order of appearance.
 */
export function getTokenLocalIds(content: string): string[] {
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  ATTACH_TOKEN_REGEX.lastIndex = 0;
  while ((m = ATTACH_TOKEN_REGEX.exec(content)) !== null) {
    ids.push(m[1]!);
  }
  return ids;
}

/**
 * Resolve tokens in content for signing: replace each [attach:localId] with "".
 * Used so the signed event has clean content (no tokens).
 */
export function resolveContentForSigning(
  content: string,
  attachmentsWithUrl: Array<{ localId: string; url?: string }>
): string {
  const urlByLocalId = new Set(
    attachmentsWithUrl.filter((a) => a.url).map((a) => a.localId)
  );
  return content
    .replace(ATTACH_TOKEN_REGEX, (_, localId) =>
      urlByLocalId.has(localId) ? "" : _
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
