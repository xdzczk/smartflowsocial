export type CommercialPlanType =
  | "free"
  | "creator"
  | "pro"
  | "teams"
  | "founder";

export type CommercialPublicPlanName =
  | "Free"
  | "Creator"
  | "Pro"
  | "Teams"
  | "Founder";

/**
 * Map persisted/legacy plan IDs (and legacy names) to canonical commercial plan types.
 *
 * Notes:
 * - Legacy/internal ids in this repo include: free, basic, premium, pro, enterprise, teams, founder.
 * - We intentionally keep this mapping layer so we can migrate DB ids later (if ever) without
 *   forcing a huge refactor.
 */
export function mapLegacyPlanIdToCommercialPlanType(
  planIdOrName: string | null | undefined
): CommercialPlanType {
  const raw = (planIdOrName ?? "").trim().toLowerCase();
  switch (raw) {
    case "free":
      return "free";
    case "basic":
      return "creator";
    case "premium":
      return "pro";
    case "pro":
      return "pro";
    case "enterprise":
      // Legacy placeholder: treat as Pro commercially for now.
      return "pro";
    case "teams":
      return "teams";
    case "founder":
      return "founder";
    default:
      return "free";
  }
}

export function getCommercialPlanDisplayName(
  planType: CommercialPlanType
): CommercialPublicPlanName {
  switch (planType) {
    case "free":
      return "Free";
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
