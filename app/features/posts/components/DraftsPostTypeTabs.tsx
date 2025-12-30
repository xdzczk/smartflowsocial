import { Link } from "@remix-run/react";
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
    <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
      <nav className="-mb-px flex space-x-8" aria-label="Post Types">
        <Link
          to={`${basePath}?tab=all`}
          className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${
            currentTab === "all"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          All ({allContentCount})
        </Link>
        <Link
          to={`${basePath}?tab=posts`}
          className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${
            currentTab === "posts"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          Posts ({postsCount})
        </Link>
        <Link
          to={`${basePath}?tab=longform`}
          className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${
            currentTab === "longform"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          Longform ({longformCount})
        </Link>
      </nav>
    </div>
  );
}











