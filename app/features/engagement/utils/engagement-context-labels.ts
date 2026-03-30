import type { ParentPost } from "../types";

export type EngagementListVariant = "replies" | "mentions" | "all";

/**
 * Human-readable source label for the left column (replaces robotic loader copy).
 */
export function displayParentContextLabel(
  parent: ParentPost,
  listVariant: EngagementListVariant
): string {
  const raw = parent.contextLabel?.trim();
  if (!raw) return "Your post";

  if (
    raw === "Referenced note (Nostr)" ||
    raw.toLowerCase().includes("referenced note")
  ) {
    if (listVariant === "mentions") return "Mention in thread";
    return "Referenced your post";
  }

  return raw;
}
