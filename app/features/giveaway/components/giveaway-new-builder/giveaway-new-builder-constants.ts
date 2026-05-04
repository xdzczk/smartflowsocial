export type BuilderScopeType =
  | "PERIOD"
  | "SINGLE_POST"
  | "FOLLOWERS"
  | "FOLLOWING";

export const GIVEAWAY_SINGLE_POST_SOURCE_OPTIONS = [
  {
    value: "create" as const,
    title: "Create new giveaway post",
    description: "Compose the note entries will target.",
  },
  {
    value: "existing" as const,
    title: "Use existing published post",
    description: "Pick a note that is already live.",
  },
] as const;

export const DEFAULT_ENGAGEMENT_ALL: Record<string, boolean> = {
  REACTION: true,
  REPOST: true,
  COMMENT: true,
  ZAP: true,
};

export const ENGAGEMENT_META: Array<{
  value: string;
  label: string;
  hint: string;
}> = [
  {
    value: "REACTION",
    label: "Reaction",
    hint: "Likes on your notes",
  },
  {
    value: "REPOST",
    label: "Repost",
    hint: "Shares / boosts",
  },
  {
    value: "COMMENT",
    label: "Comment",
    hint: "Replies in the thread",
  },
  {
    value: "ZAP",
    label: "Zap",
    hint: "Lightning tips on content",
  },
];

export const SCOPE_TYPE_OPTIONS: ReadonlyArray<{
  value: BuilderScopeType;
  title: string;
  desc: string;
}> = [
  {
    value: "PERIOD",
    title: "Period",
    desc: "Engagement across your recent posts",
  },
  {
    value: "SINGLE_POST",
    title: "Single post",
    desc: "Engagement on that note only  -  not nested replies deeper in the thread",
  },
  {
    value: "FOLLOWERS",
    title: "Followers",
    desc: "People who follow you now",
  },
  {
    value: "FOLLOWING",
    title: "Following",
    desc: "Accounts you follow",
  },
];

export function asideScopeLine(
  scopeType: BuilderScopeType,
  periodMode: "days" | "custom"
): string {
  if (scopeType === "PERIOD") {
    return periodMode === "days"
      ? "Period (days + optional queue)"
      : "Custom range";
  }
  const hit = SCOPE_TYPE_OPTIONS.find((o) => o.value === scopeType);
  return hit?.title ?? scopeType;
}
