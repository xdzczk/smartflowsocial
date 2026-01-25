import { Link } from "@remix-run/react";

const ACTIVE_TAB_CLASSES =
  "border-border text-foreground dark:border-primary dark:text-primary";
const INACTIVE_TAB_CLASSES =
  "border-transparent text-muted-foreground hover:border-border hover:text-foreground";

interface DraftsPostTypeTabsProps {
  currentTab: string;
  allContentCount: number;
  postsCount: number;
  longformCount: number;
  queueType?: string;
}

/**
 * Post type tabs for drafts page
 */
export function DraftsPostTypeTabs({
  currentTab,
  allContentCount,
  postsCount,
  longformCount,
  queueType,
}: DraftsPostTypeTabsProps) {
  const basePath = queueType
    ? `/dashboard/drafts/${queueType}`
    : "/dashboard/drafts";

  return (
    <div className="border-border mb-6 border-b">
      <nav className="-mb-px flex space-x-8" aria-label="Post Types">
        <Link
          to={`${basePath}?tab=all`}
          className={`border-b-2 px-1 py-2 text-sm font-medium whitespace-nowrap ${
            currentTab === "all" ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES
          }`}
        >
          All ({allContentCount})
        </Link>
        <Link
          to={`${basePath}?tab=posts`}
          className={`border-b-2 px-1 py-2 text-sm font-medium whitespace-nowrap ${
            currentTab === "posts" ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES
          }`}
        >
          Posts ({postsCount})
        </Link>
        <Link
          to={`${basePath}?tab=longform`}
          className={`border-b-2 px-1 py-2 text-sm font-medium whitespace-nowrap ${
            currentTab === "longform"
              ? ACTIVE_TAB_CLASSES
              : INACTIVE_TAB_CLASSES
          }`}
        >
          Longform ({longformCount})
        </Link>
      </nav>
    </div>
  );
}
