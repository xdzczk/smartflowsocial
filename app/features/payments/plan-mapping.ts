export type CommercialPlanType =
  | "free"
  | "starter"
  | "creator"
  | "pro"
  | "teams"
  | "founder";

export type CommercialPublicPlanName =
  | "Free"
  | "Starter"
  | "Creator"
  | "Pro"
  | "Teams"
  | "Founder";

/**
 * Parse a plan id/name to canonical commercial plan type.
 * Returns null for unknown values (strict cutover behavior).
 */
export function parseCommercialPlanType(
  planIdOrName: string | null | undefined
): CommercialPlanType | null {
  const raw = (planIdOrName ?? "").trim().toLowerCase();
  switch (raw) {
    case "free":
      return "free";
    case "starter":
      return "starter";
    case "creator":
      return "creator";
    case "pro":
      return "pro";
    case "teams":
      return "teams";
    case "founder":
      return "founder";
    default:
      return null;
  }
}

/**
 * Map persisted plan IDs (and plan display names) to canonical commercial plan types.
 * Fallback behavior is retained for non-critical callers.
 */
export function mapLegacyPlanIdToCommercialPlanType(
  planIdOrName: string | null | undefined
): CommercialPlanType {
  return parseCommercialPlanType(planIdOrName) ?? "free";
}

export function getCommercialPlanDisplayName(
  planType: CommercialPlanType
): CommercialPublicPlanName {
  switch (planType) {
    case "free":
      return "Free";
    case "starter":
      return "Starter";
    case "creator":
      return "Creator";
    case "pro":
      return "Pro";
    case "teams":
      return "Teams";
    case "founder":
      return "Founder";
  }
}
