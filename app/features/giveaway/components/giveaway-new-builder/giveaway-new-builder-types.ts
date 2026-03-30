import type { PlanType } from "~/features/payments/types";

export interface GiveawayNewBuilderProps {
  presets: Array<{
    id: string;
    name: string;
    scopeType: string;
    winnerCount: number;
  }>;
  queueTypes: Array<{ id: string; name: string }>;
  recentPosts: Array<{
    id: string;
    caption: string | null;
    publishedAt: string;
    fileUrl: string[];
    postType: string;
  }>;
  planLimits: {
    maxWinnerCount: number;
    canUseQueueScope: boolean;
    canUsePresets: boolean;
  };
  planType: PlanType;
  planDisplayName: string;
  /** New-post route loader fields for embedded composer (single-post → create). */
  composerLoader: Record<string, unknown>;
  userTimezone: string;
  actionError?: string;
}
