/**
 * Optional thread mode: prefix each segment body with "n) " (1-based index).
 * Strips a single leading "digits) optional whitespace" token before re-applying.
 */

const LEADING_THREAD_INDEX_PATTERN = /^\d+\)\s*/;

export function stripLeadingThreadSegmentNumber(content: string): string {
  return content.replace(LEADING_THREAD_INDEX_PATTERN, "");
}

export function applyThreadSegmentNumberingToSegments<
  T extends { content: string },
>(segments: T[]): T[] {
  return segments.map((s, i) => ({
    ...s,
    content: `${i + 1}) ${stripLeadingThreadSegmentNumber(s.content)}`,
  }));
}
