/**
 * Engagement feed type tabs: All, Replies, Mentions (quotes + mention-type)
 */

import type { EngagementTypeTab } from "../hooks/useEngagementState";

const ACTIVE_TAB_CLASSES = "border-brand text-text font-semibold";
const INACTIVE_TAB_CLASSES =
  "border-transparent text-text-secondary hover:border-border hover:text-text";

interface EngagementTabsProps {
  activeTab: EngagementTypeTab;
  onTabChange: (tab: EngagementTypeTab) => void;
  repliesCount: number;
  mentionsCount: number;
  needsResponseCount: number;
}

export function EngagementTabs({
  activeTab,
  onTabChange,
  repliesCount,
  mentionsCount,
  needsResponseCount,
}: EngagementTabsProps) {
  return (
    <div className="flex-shrink-0">
      <nav
        className="-mb-px flex flex-wrap gap-x-10 gap-y-1"
        aria-label="Type tabs"
      >
        <button
          type="button"
          onClick={() => onTabChange("all")}
          className={`border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
            activeTab === "all" ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => onTabChange("replies")}
          className={`border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
            activeTab === "replies" ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES
          }`}
        >
          Replies ({repliesCount})
        </button>
        <button
          type="button"
          onClick={() => onTabChange("needs-response")}
          className={`border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
            activeTab === "needs-response"
              ? ACTIVE_TAB_CLASSES
              : INACTIVE_TAB_CLASSES
          }`}
        >
          Needs response ({needsResponseCount})
        </button>
        <button
          type="button"
          onClick={() => onTabChange("mentions")}
          className={`border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
            activeTab === "mentions" ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES
          }`}
        >
          Mentions ({mentionsCount})
        </button>
      </nav>
    </div>
  );
}
