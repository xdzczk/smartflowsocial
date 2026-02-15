/**
 * Shared header for list pages (Scheduled and Published).
 * Shows section title that updates with content-type tab.
 */

interface ContentListPageHeaderProps {
  /** Which list page: scheduled or published */
  pageType: "scheduled" | "published";
  /** Current content-type tab (all, posts, reposts, longform) */
  currentTab: string;
  /** Optional class for layout */
  className?: string;
}

function getTitle(
  pageType: "scheduled" | "published",
  currentTab: string
): string {
  const prefix = pageType === "scheduled" ? "Scheduled" : "Published";
  if (currentTab === "all") return prefix;
  if (currentTab === "posts") return `${prefix} Posts`;
  if (currentTab === "reposts") return `${prefix} Reposts`;
  return `${prefix} Articles`;
}

export function ContentListPageHeader({
  pageType,
  currentTab,
  className,
}: ContentListPageHeaderProps) {
  return (
    <div
      className={`flex flex-shrink-0 flex-row items-center text-left ${className ?? ""}`}
    >
      <h3 className="font-semibold">{getTitle(pageType, currentTab)}</h3>
    </div>
  );
}
