/**
 * Engagement feed type tabs: All, Replies, Mentions (quotes + mention-type)
 */

import type { EngagementTypeTab } from "../hooks/useEngagementState";

const ACTIVE_TAB_CLASSES =
  "border-border text-foreground dark:border-primary dark:text-primary";
const INACTIVE_TAB_CLASSES =
  "border-transparent text-muted-foreground hover:border-border hover:text-foreground";

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
      <nav className="-mb-px flex space-x-8" aria-label="Type tabs">
        <button
          type="button"
          onClick={() => onTabChange("all")}
          className={`border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap ${
            activeTab === "all" ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => onTabChange("replies")}
          className={`border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap ${
            activeTab === "replies" ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES
          }`}
        >
          Replies ({repliesCount})
        </button>
        <button
          type="button"
          onClick={() => onTabChange("needs-response")}
          className={`border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap ${
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
          className={`border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap ${
            activeTab === "mentions" ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES
          }`}
        >
          Mentions ({mentionsCount})
        </button>
      </nav>
    </div>
  );
}
