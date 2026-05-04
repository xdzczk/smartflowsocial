import type { SettingsTabId } from "~/features/settings/settings-sections";
import { normalizeSettingsTabParam } from "~/features/settings/settings-sections";

/** Remix `match.id` for flat route modules under `app/routes/`. */
export type DashboardLeafRouteId = string;

export interface DashboardSeoSegment {
  page: string;
}

const NOINDEX = "noindex, nofollow" as const;

/** Static titles for dashboard leaf routes (see `npx remix routes`). */
export const DASHBOARD_SEO_SEGMENT: Record<string, DashboardSeoSegment> = {
  "routes/dashboard._index": { page: "Dashboard" },
  "routes/dashboard.drafts": { page: "Drafts" },
  "routes/dashboard.drafts.$queueType": { page: "Drafts" },
  "routes/dashboard.drafts.edit.$id": { page: "Edit Post" },
  "routes/dashboard.drafts.longform.edit.$id": { page: "Edit Post" },
  "routes/dashboard.templates": { page: "Templates" },
  "routes/dashboard.templates.new": { page: "Templates" },
  "routes/dashboard.templates.new._index": { page: "Templates" },
  "routes/dashboard.templates.new.post": { page: "Templates" },
  "routes/dashboard.templates.new.longform": { page: "Templates" },
  "routes/dashboard.templates.edit.$id": { page: "Edit Template" },
  "routes/dashboard.scheduled": { page: "Scheduled" },
  "routes/dashboard.scheduled.$queueType": { page: "Scheduled" },
  "routes/dashboard.published": { page: "Published" },
  "routes/dashboard.published.$queueType": { page: "Published" },
  "routes/dashboard.posted": { page: "Published" },
  "routes/dashboard.posted.$queueType": { page: "Published" },
  "routes/dashboard.calendar": { page: "Calendar" },
  "routes/dashboard.calendar.$queueType": { page: "Calendar" },
  "routes/dashboard.newpost": { page: "Composer" },
  "routes/dashboard.newlongformpost": { page: "Composer" },
  "routes/dashboard.compose": { page: "Composer" },
  "routes/dashboard.compose._index": { page: "Composer" },
  "routes/dashboard.compose.article": { page: "Composer" },
  "routes/dashboard.bulkposts": { page: "Composer" },
  "routes/dashboard.recyclables": { page: "Drafts" },
  "routes/dashboard.recyclables.$queueType": { page: "Drafts" },
  "routes/dashboard.search.posts": { page: "Search" },
  "routes/dashboard.broadcasts._index": { page: "Broadcasts" },
  "routes/dashboard.broadcasts.new": { page: "Broadcasts" },
  "routes/dashboard.broadcasts.new.review": { page: "Review Broadcast" },
  "routes/dashboard.broadcasts.audiences": { page: "Broadcast Audiences" },
  "routes/dashboard.broadcasts.suppression": { page: "Broadcast Suppression" },
  "routes/dashboard.broadcasts.settings": { page: "Broadcast Settings" },
  "routes/dashboard.giveaway._index": { page: "Giveaways" },
  "routes/dashboard.giveaway.$queueType": { page: "Giveaways" },
  "routes/dashboard.giveaway.new": { page: "Giveaways" },
  "routes/dashboard.giveaway.presets": { page: "Giveaways" },
  "routes/dashboard.giveaway.proof": { page: "Giveaways" },
  "routes/dashboard.contests._index": { page: "Contests" },
  "routes/dashboard.contests.new": { page: "Contest Builder" },
  "routes/dashboard.contests.presets": { page: "Contests" },
  "routes/dashboard.contests.proof": { page: "Contests" },
  "routes/dashboard.engagement.feed": { page: "Engagement" },
  "routes/dashboard.settings.media": { page: "Media & Storage" },
  "routes/dashboard.admin._index": { page: "Admin" },
  "routes/dashboard.admin.users": { page: "Admin" },
  "routes/dashboard.admin.referrals": { page: "Admin" },
  "routes/dashboard.admin.analytics": { page: "Admin" },
  "routes/dashboard.admin.earnings": { page: "Admin" },
  "routes/dashboard.admin.operations": { page: "Admin" },
};

export function settingsTabToPageTitle(tab: SettingsTabId | null): string {
  if (!tab) {
    return "Settings";
  }
  switch (tab) {
    case "general":
      return "General Settings";
    case "publishing":
      return "Publishing";
    case "engagement":
      return "Engagement";
    case "accounts":
      return "Accounts";
    case "relays":
      return "Relays";
    case "media":
      return "Media & Storage";
    case "signers":
      return "Signers & Access";
    case "billing":
      return "Billing";
    default:
      return "Settings";
  }
}

interface BroadcastCampaignData {
  campaign?: { name?: string | null };
}

interface ContestDetailData {
  contest?: { title?: string };
}

interface GiveawayDetailData {
  giveaway?: { name?: string | null };
}

export function resolveDashboardPageLabel(args: {
  leafId: string;
  search: string;
  leafData: unknown;
}): string {
  const { leafId, search, leafData } = args;

  if (leafId === "routes/dashboard.settings") {
    const tab = normalizeSettingsTabParam(
      new URLSearchParams(search).get("tab")
    );
    return settingsTabToPageTitle(tab);
  }

  if (leafId === "routes/dashboard.broadcasts.$id") {
    const name = (
      leafData as BroadcastCampaignData | null
    )?.campaign?.name?.trim();
    /* Empty trimmed title should fall back like missing  -  `??` only covers nullish */
    return (name && name.length > 0 ? name : undefined) ?? "Broadcast";
  }

  if (leafId === "routes/dashboard.contests.detail.$id") {
    const title = (
      leafData as ContestDetailData | null
    )?.contest?.title?.trim();
    return (title && title.length > 0 ? title : undefined) ?? "Contest";
  }

  if (leafId === "routes/dashboard.giveaway.detail.$id") {
    const name = (
      leafData as GiveawayDetailData | null
    )?.giveaway?.name?.trim();
    return (name && name.length > 0 ? name : undefined) ?? "Giveaway";
  }

  const seg = DASHBOARD_SEO_SEGMENT[leafId];
  if (seg) {
    return seg.page;
  }

  return "Dashboard";
}

export { NOINDEX };
