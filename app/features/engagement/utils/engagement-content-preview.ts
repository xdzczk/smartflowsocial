const LONG_TOKEN = /[^\s]{80,}/;
const NOSTR_REF = /nostr:(naddr|note|nevent|nprofile)1[a-z0-9]+/gi;

export type EngagementPreviewVariant = "default" | "mention";

export interface EngagementContentPreviewResult {
  /** Plain text safe for preview */
  text: string;
  /** User-visible hint */
  isTruncated: boolean;
  /** Long unbroken / encoded-looking content collapsed */
  noisy: boolean;
}

function stripNoiseForPreview(content: string, aggressive: boolean): string {
  let s = content.replace(/\s+/g, " ").trim();
  if (aggressive) {
    s = s.replace(NOSTR_REF, "…");
  }
  return s;
}

/**
 * Build a short preview line for engagement bodies; stricter for mentions inbox.
 */
export function buildEngagementContentPreview(
  content: string,
  variant: EngagementPreviewVariant
): EngagementContentPreviewResult {
  const aggressive = variant === "mention";
  const cleaned = stripNoiseForPreview(content, aggressive);
  let noisy = LONG_TOKEN.test(content);
  let text = cleaned;

  if (noisy && aggressive) {
    const firstSpaceChunk = cleaned.split(/\s+/).find((w) => w.length < 80);
    if (firstSpaceChunk && firstSpaceChunk.length > 0) {
      text = firstSpaceChunk;
      if (text.length < cleaned.length) text += "…";
    } else {
      text = cleaned.slice(0, 120).trimEnd() + "…";
    }
  }

  const maxLen = aggressive ? 220 : 320;
  let isTruncated = text.length > maxLen;
  if (isTruncated) {
    text = text.slice(0, maxLen).trimEnd() + "…";
  }

  return { text, isTruncated, noisy };
}
