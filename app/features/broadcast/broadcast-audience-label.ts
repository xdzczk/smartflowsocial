/**
 * Pure audience labels for UI (safe for client bundles — not in *.server.ts).
 */
export function formatBroadcastAudienceLabel(
  audienceType: string,
  customCount: number
): string {
  switch (audienceType) {
    case "CUSTOM":
      return `Custom (${String(customCount)})`;
    case "FOLLOWING":
      return "Following";
    case "MUTUALS":
      return "Mutuals";
    default:
      return audienceType;
  }
}
