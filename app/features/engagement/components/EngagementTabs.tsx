/**
 * Engagement feed tabs component
 */

const ACTIVE_TAB_CLASSES =
  "border-purple-500 text-purple-600 dark:border-purple-400 dark:text-purple-400";
const INACTIVE_TAB_CLASSES =
  "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300";

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
    <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
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
