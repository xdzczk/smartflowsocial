import { buildProofSummary } from "./build-proof-summary";
import type { ProofCardPayload } from "./types";

const BRAND_LINE = "— SmartFlow Social";

/**
 * Short social caption — compact single-paragraph feel where possible.
 */
export function buildProofCaption(payload: ProofCardPayload): string {
  if (payload.domain === "giveaway" && payload.cardType === "public-summary") {
    const payout =
      payload.satsPlanned != null && payload.satsPlanned > 0
        ? `${payload.satsPlanned.toLocaleString()} sats distributed`
        : "winners selected";
    const winners = payload.winnersCount ?? 0;
    const w = `${winners} winner${winners === 1 ? "" : "s"}`;
    const core = `Completed giveaway: ${payload.title}. ${w}, ${payout}.`;
    return `${core} ${BRAND_LINE}`.replace(/\s+/g, " ").trim();
  }

  if (payload.domain === "contest" && payload.cardType === "public-summary") {
    const winners = payload.winnersCount ?? 0;
    const sats = payload.satsPlanned ?? 0;
    const core = `Contest complete: ${payload.title}. ${winners} winner${winners === 1 ? "" : "s"} · ${sats.toLocaleString()} sats.`;
    return `${core} ${BRAND_LINE}`.replace(/\s+/g, " ").trim();
  }

  if (payload.domain === "admin") {
    const core = buildProofSummary(payload)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220);
    return `${core}\n\n— SmartFlowSocial`;
  }

  const core = buildProofSummary(payload)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
  return `${core} ${BRAND_LINE}`.replace(/\s+/g, " ").trim();
}
