/**
 * Engagement feed type tabs: All, Replies, Needs response, Mentions.
 * Underline tabs use selection tokens for the active indicator (not raw brand).
 */

import { cn } from "~/lib/utils";

import type { EngagementTypeTab } from "../hooks/useEngagementState";

/** Single literal for the "needs response" tab (sonarjs/no-duplicate-string). */
const ENGAGEMENT_TAB_NEEDS_RESPONSE: EngagementTypeTab = "needs-response";

interface EngagementTabsProps {
  activeTab: EngagementTypeTab;
  onTabChange: (tab: EngagementTypeTab) => void;
  repliesCount: number;
  mentionsCount: number;
  needsResponseCount: number;
  /** DOM id of the controlled `tabpanel`. */
  tabPanelId: string;
}

const TAB_IDS: Record<EngagementTypeTab, string> = {
  all: "engagement-tab-all",
  replies: "engagement-tab-replies",
  [ENGAGEMENT_TAB_NEEDS_RESPONSE]: "engagement-tab-needs-response",
  mentions: "engagement-tab-mentions",
};

function tabButtonClass(active: boolean): string {
  return cn(
    "focus-ring motion-fast -mb-px border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap",
    active
      ? "border-selection-border text-text font-semibold"
      : "border-transparent text-text-secondary hover:border-border hover:text-text"
  );
}

export function EngagementTabs({
  activeTab,
  onTabChange,
  repliesCount,
  mentionsCount,
  needsResponseCount,
  tabPanelId,
}: EngagementTabsProps) {
  return (
    <div className="min-w-0 shrink-0">
      <div
        className="-mb-px flex flex-wrap gap-x-6 gap-y-1"
        role="tablist"
        aria-label="Engagement type"
      >
        <button
          type="button"
          role="tab"
          id={TAB_IDS.all}
          aria-selected={activeTab === "all"}
          aria-controls={tabPanelId}
          className={tabButtonClass(activeTab === "all")}
          onClick={() => onTabChange("all")}
        >
          All
        </button>
        <button
          type="button"
          role="tab"
          id={TAB_IDS.replies}
          aria-selected={activeTab === "replies"}
          aria-controls={tabPanelId}
          className={tabButtonClass(activeTab === "replies")}
          onClick={() => onTabChange("replies")}
        >
          Replies ({repliesCount})
        </button>
        <button
          type="button"
          role="tab"
          id={TAB_IDS[ENGAGEMENT_TAB_NEEDS_RESPONSE]}
          aria-selected={activeTab === ENGAGEMENT_TAB_NEEDS_RESPONSE}
          aria-controls={tabPanelId}
          className={tabButtonClass(
            activeTab === ENGAGEMENT_TAB_NEEDS_RESPONSE
          )}
          onClick={() => onTabChange(ENGAGEMENT_TAB_NEEDS_RESPONSE)}
        >
          Needs response ({needsResponseCount})
        </button>
        <button
          type="button"
          role="tab"
          id={TAB_IDS.mentions}
          aria-selected={activeTab === "mentions"}
          aria-controls={tabPanelId}
          className={tabButtonClass(activeTab === "mentions")}
          onClick={() => onTabChange("mentions")}
        >
          Mentions ({mentionsCount})
        </button>
      </div>
    </div>
  );
}
