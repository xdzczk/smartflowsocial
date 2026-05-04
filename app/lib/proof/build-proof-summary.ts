import type { ProofCardPayload } from "./types";

function footerLines(f: ProofCardPayload["footer"]): string[] {
  if (!f) return [];
  const out: string[] = [];
  if (f.productLabel) out.push(f.productLabel);
  if (f.snapshotLabel) out.push(f.snapshotLabel);
  if (f.timeRangeLabel) out.push(f.timeRangeLabel);
  if (f.referenceLabel) out.push(f.referenceLabel);
  return out;
}

/**
 * Multi-line summary for clipboard  -  derived from the same payload as the visual card.
 */
export function buildProofSummary(payload: ProofCardPayload): string {
  const lines: string[] = [];

  if (payload.eyebrow) lines.push(payload.eyebrow);

  if (payload.metricFirst && payload.heroValue != null) {
    lines.push(
      payload.heroLabel
        ? `${payload.heroValue} - ${payload.heroLabel}`
        : payload.heroValue
    );
    if (payload.title.trim().length > 0) lines.push(payload.title);
    if (payload.subtitle) lines.push(payload.subtitle);
  } else {
    const headline =
      payload.heroValue != null && payload.heroLabel != null
        ? `${payload.heroValue} - ${payload.heroLabel}`
        : (payload.heroValue ?? payload.title);

    if (payload.heroValue != null || payload.heroLabel != null) {
      lines.push(headline);
      if (payload.subtitle) lines.push(payload.subtitle);
    } else {
      lines.push(payload.title);
      if (payload.subtitle) lines.push(payload.subtitle);
    }
  }

  if (payload.statusBadge) {
    lines.push(`Status: ${payload.statusBadge.label}`);
  }

  for (const s of payload.stats ?? []) {
    lines.push(`${s.label}: ${s.value}`);
  }

  lines.push(...footerLines(payload.footer));

  return lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n");
}
