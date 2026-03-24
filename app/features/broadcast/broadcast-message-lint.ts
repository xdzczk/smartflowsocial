import {
  BROADCAST_PLAINTEXT_MAX_CHARS,
  BROADCAST_UNSUBSCRIBE_FOOTER_RESERVE_CHARS,
} from "./broadcast-unsubscribe-copy";

export interface BroadcastMessageLint {
  level: "warning";
  message: string;
}

function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface BroadcastMessageLintOptions {
  recentBroadcastSnippet?: string | null;
  /** When true, warn if body may exceed max length once the unsubscribe footer is appended. */
  footerReserveChars?: boolean;
}

/** Non-blocking heuristics (pure; safe for client or server). */
export function getBroadcastMessageLintWarnings(
  body: string,
  options?: BroadcastMessageLintOptions
): BroadcastMessageLint[] {
  const t = body.trim();
  const out: BroadcastMessageLint[] = [];

  if (options?.footerReserveChars) {
    if (
      t.length + BROADCAST_UNSUBSCRIBE_FOOTER_RESERVE_CHARS >
      BROADCAST_PLAINTEXT_MAX_CHARS
    ) {
      out.push({
        level: "warning",
        message:
          "Message is long enough that the required unsubscribe footer may exceed the maximum length when you sign—shorten the text or links.",
      });
    }
  }
  if (t.length > 0 && t.length < 20) {
    out.push({
      level: "warning",
      message:
        "This message is very short and may feel low-context to recipients.",
    });
  }
  if (t.length > 4000) {
    out.push({
      level: "warning",
      message: "Message is unusually long for direct delivery.",
    });
  }

  const withoutUrls = t.replace(/https?:\/\/\S+/gi, "").trim();
  if (t.length > 0 && withoutUrls.length < 12) {
    out.push({
      level: "warning",
      message:
        "This message is mostly a link or nearly empty—recipients may not understand why you wrote.",
    });
  }

  if (t.length >= 25) {
    const contextCue =
      /\b(you|your|we|our|thanks|thank you|update|because|since|follow|mutual|subscriber|broadcast|replied|dm)\b/i;
    if (!contextCue.test(t)) {
      out.push({
        level: "warning",
        message:
          "Consider explaining why the recipient is receiving this update.",
      });
    }
  }

  const recent = options?.recentBroadcastSnippet?.trim();
  if (recent && recent.length > 40 && t.length > 40) {
    const sim = jaccardSimilarity(tokenSet(t), tokenSet(recent));
    if (sim >= 0.45) {
      out.push({
        level: "warning",
        message: "This message is similar to a recent broadcast.",
      });
    }
  }

  const upper = (t.match(/[A-Z]/g) ?? []).length;
  const letters = (t.match(/[A-Za-z]/g) ?? []).length;
  if (letters > 40 && upper / letters > 0.6) {
    out.push({
      level: "warning",
      message: "Heavy use of capitals can read as shouty or spam-like.",
    });
  }
  const urlMatches = t.match(/https?:\/\/\S+/gi) ?? [];
  if (urlMatches.length >= 4) {
    out.push({
      level: "warning",
      message: "Many links in one DM can trigger spam heuristics on clients.",
    });
  }
  const cta =
    /\b(click here|buy now|limited time|act now|subscribe now|don't miss)\b/gi;
  const ctaHits = [...t.matchAll(cta)].length;
  if (ctaHits >= 2) {
    out.push({
      level: "warning",
      message: "Repeated call-to-action phrasing may feel promotional.",
    });
  }
  return out;
}
