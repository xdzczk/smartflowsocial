export interface BroadcastMessageLint {
  level: "warning";
  message: string;
}

/** Non-blocking heuristics (pure; safe for client or server). */
export function getBroadcastMessageLintWarnings(
  body: string
): BroadcastMessageLint[] {
  const t = body.trim();
  const out: BroadcastMessageLint[] = [];
  if (t.length > 0 && t.length < 20) {
    out.push({
      level: "warning",
      message: "Message is very short and may lack context.",
    });
  }
  if (t.length > 4000) {
    out.push({
      level: "warning",
      message: "Message is unusually long for direct delivery.",
    });
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
