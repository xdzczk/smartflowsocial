import type { BroadcastDeliveryMode } from "@prisma/client";

const LABELS: Record<BroadcastDeliveryMode, string> = {
  BEST_COMPATIBILITY: "Best compatibility",
  NIP17_ONLY: "NIP-17 only",
  NIP04_ONLY: "NIP-04 only",
  NIP17_FALLBACK_NIP04: "NIP-17 with NIP-04 fallback",
  BOTH: "Both (expert)",
};

export function formatBroadcastDeliveryMode(
  mode: BroadcastDeliveryMode
): string {
  return LABELS[mode];
}

/** Plain-language compatibility note for review (honest about current client signing). */
export function broadcastCompatibilityForecastNote(
  mode: BroadcastDeliveryMode
): string {
  switch (mode) {
    case "BEST_COMPATIBILITY":
      return "Workers will publish your signed kind 4 DM to relays. Optional NIP-17 gift wraps are included when present on each recipient row after signing. Best compatibility uses the broadest safe path the signer provides.";
    case "NIP17_ONLY":
      return "NIP-17–only sends rely on gift wraps; ensure your signer produces wraps for each recipient or delivery may fail.";
    case "NIP04_ONLY":
      return "Legacy NIP-04 (kind 4) only—narrower privacy model, widest legacy client support.";
    case "NIP17_FALLBACK_NIP04":
      return "Prefer modern NIP-17 delivery where wraps exist; kind 4 remains the baseline encrypted payload.";
    case "BOTH":
      return "Expert mode: both paths may be used where the signed payload allows—higher relay load.";
    default:
      return "";
  }
}
