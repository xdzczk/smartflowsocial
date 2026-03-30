import type { ParentPost } from "../types";

export type EngagementListVariant = "replies" | "mentions" | "all";

function parentHasSourceBody(parent: ParentPost): boolean {
  if (parent.fileUrl) return true;
  if (parent.isLongform) {
    return (
      (parent.title?.trim() ?? "") !== "" ||
      (parent.content?.trim() ?? "") !== ""
    );
  }
  return Boolean(parent.caption?.trim());
}

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

/** Compact second line under the source title when extra context helps scanning. */
export function displayParentContextSublabel(
  parent: ParentPost,
  listVariant: EngagementListVariant
): string | null {
  const raw = parent.contextLabel?.trim();
  const title = displayParentContextLabel(parent, listVariant);
  if (!raw && title === "Your post") {
    if (listVariant !== "mentions") return null;
    return parentHasSourceBody(parent) ? null : "Unknown source note";
  }
  if (
    listVariant === "mentions" &&
    raw &&
    (raw === "Referenced note (Nostr)" ||
      raw.toLowerCase().includes("referenced note"))
  ) {
    return "Referenced your note";
  }
  return null;
}
