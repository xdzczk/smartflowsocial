/**
 * Engagement feed tabs component
 */

const ACTIVE_TAB_CLASSES = "border-primary text-primary";
const INACTIVE_TAB_CLASSES =
  "border-transparent text-muted-foreground hover:border-border hover:text-foreground";

interface EngagementTabsProps {
  activeTab: "all" | "replies" | "quotes";
  onTabChange: (tab: "all" | "replies" | "quotes") => void;
  repliesCount: number;
  quotesCount: number;
}

export function EngagementTabs({
  activeTab,
  onTabChange,
  repliesCount,
  quotesCount,
}: EngagementTabsProps) {
  return (
    <div className="border-border mb-6 border-b">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        <button
          onClick={() => onTabChange("all")}
          className={`border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap ${
            activeTab === "all" ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES
          }`}
        >
          All
        </button>
        <button
          onClick={() => onTabChange("replies")}
          className={`border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap ${
            activeTab === "replies" ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES
          }`}
        >
          Replies ({repliesCount})
        </button>
        <button
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
