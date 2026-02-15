/**
 * Shared header for list pages (Scheduled, Published, Calendar, Drafts) and Dashboard flow.
 * Shows section title that updates with content-type tab (or fixed "Your flow" for Dashboard).
 */

interface ContentListPageHeaderProps {
  /** Which page: flow (Dashboard), or list page type */
  pageType: "flow" | "scheduled" | "published" | "calendar" | "drafts";
  /** Current content-type tab (all, posts, reposts, longform, bulk). Optional when pageType === "flow". */
  currentTab?: string;
  /** Optional class for layout */
  className?: string;
}

function getTitle(
  pageType: "flow" | "scheduled" | "published" | "calendar" | "drafts",
  currentTab: string
): string {
  if (pageType === "flow") return "Your flow";
  if (currentTab === "bulk") return "Bulk drafts";

  const prefix =
    pageType === "scheduled"
      ? "Scheduled"
      : pageType === "published"
        ? "Published"
        : pageType === "calendar"
          ? "Calendar"
          : "Drafts";
  if (currentTab === "all") return prefix;
  if (currentTab === "posts") return `${prefix} Posts`;
  if (currentTab === "reposts") return `${prefix} Reposts`;
  return `${prefix} Articles`;
}

export function ContentListPageHeader({
  pageType,
  currentTab = "all",
  className,
}: ContentListPageHeaderProps) {
  const title =
    pageType === "flow" ? "Your flow" : getTitle(pageType, currentTab);

  return (
    <div
      className={`flex flex-shrink-0 flex-row items-center text-left ${className ?? ""}`}
    >
      <h3 className="font-semibold">{title}</h3>
    </div>
  );
}
