export function getContentListDateSortKey(
  type: "scheduled" | "draft" | "published"
): "publishedAt" | "scheduledAtUtc" | "updatedAt" {
  if (type === "published") return "publishedAt";
  if (type === "scheduled") return "scheduledAtUtc";
  return "updatedAt";
}

export function getInitialContentSortConfig(
  type: "scheduled" | "draft" | "published"
): {
  key: string;
  direction: "asc" | "desc";
} {
  const key = getContentListDateSortKey(type);
  const direction = type === "scheduled" ? "asc" : "desc";
  return { key, direction };
}
