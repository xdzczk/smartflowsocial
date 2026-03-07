/**
 * Engagement feed tabs component
 * Row 1: Inbox (Unread, All, Handled, Replied)
 * Row 2: Type (All, Replies, Repost with Quote)
 */

import type { EngagementTypeTab, InboxTab } from "../hooks/useEngagementState";

const ACTIVE_TAB_CLASSES =
  "border-border text-foreground dark:border-primary dark:text-primary";
const INACTIVE_TAB_CLASSES =
  "border-transparent text-muted-foreground hover:border-border hover:text-foreground";

interface EngagementTabsProps {
  inboxTab: InboxTab;
  onInboxTabChange: (tab: InboxTab) => void;
  activeTab: EngagementTypeTab;
  onTabChange: (tab: EngagementTypeTab) => void;
  unreadCount: number;
  handledCount: number;
  repliedCount: number;
  repliesCount: number;
  quotesCount: number;
}

export function EngagementTabs({
  inboxTab,
  onInboxTabChange,
  activeTab,
  onTabChange,
  unreadCount,
  handledCount,
  repliedCount,
  repliesCount,
  quotesCount,
}: EngagementTabsProps) {
  return (
    <div className="border-border mb-6 space-y-4 border-b">
      {/* Inbox tabs */}
      <nav
        className="-mb-px flex flex-wrap gap-x-6 gap-y-2"
        aria-label="Inbox tabs"
      >
        <button
          type="button"
          onClick={() => onInboxTabChange("unread")}
          className={`border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap ${
            inboxTab === "unread" ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          type="button"
          onClick={() => onInboxTabChange("all")}
          className={`border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap ${
            inboxTab === "all" ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => onInboxTabChange("handled")}
          className={`border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap ${
            inboxTab === "handled" ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES
          }`}
        >
          Handled ({handledCount})
        </button>
        <button
          type="button"
          onClick={() => onInboxTabChange("replied")}
          className={`border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap ${
            inboxTab === "replied" ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES
          }`}
        >
          Replied ({repliedCount})
        </button>
      </nav>

      {/* Type filter tabs */}
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
          onClick={() => onTabChange("quotes")}
          className={`border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap ${
            activeTab === "quotes" ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES
          }`}
        >
          Repost with Quote ({quotesCount})
        </button>
      </nav>
    </div>
  );
}
