/** Spam-risk labels for Audience Builder v2 (spec §11.3). */

export type AudienceRiskLevel = "low" | "moderate" | "curated" | "depends";

export function audienceRiskForSource(
  source: "FOLLOWERS" | "MUTUALS" | "CUSTOM" | "SAVED"
): { level: AudienceRiskLevel; label: string } {
  switch (source) {
    case "MUTUALS":
      return { level: "low", label: "Lower spam risk" };
    case "FOLLOWERS":
      return { level: "moderate", label: "Moderate spam risk — broader reach" };
    case "CUSTOM":
      return {
        level: "curated",
        label: "Followers only (verified at send)",
      };
    case "SAVED":
      return { level: "depends", label: "Depends on saved definition" };
    default:
      return { level: "depends", label: "—" };
  }
}
