import { Link, useParams } from "@remix-run/react";

const ACTIVE_TAB_CLASSES =
  "border-border text-foreground dark:border-primary dark:text-primary";
const INACTIVE_TAB_CLASSES =
  "border-transparent text-muted-foreground hover:border-border hover:text-foreground";

interface QueueType {
  name: string;
  color?: string;
  isEnabled?: boolean;
}

interface PublishedPostsTabsProps {
  currentTab: string;
  queueTypes: Array<string | QueueType>;
  allContentLength: number;
  postsLength: number;
  longformPostsLength: number;
}

export default function PublishedPostsTabs({
  currentTab,
  queueTypes: _queueTypes,
  allContentLength,
  postsLength,
  longformPostsLength,
}: PublishedPostsTabsProps) {
  const params = useParams();

  return (
    <>
      {/* Post Type Tabs */}
      <div className="border-border mb-6 border-b">
        <nav className="-mb-px flex space-x-8" aria-label="Post Types">
          <Link
            to={`/dashboard/published${params["queueType"] ? `/${params["queueType"]}` : ""}?tab=all`}
            className={`border-b-2 px-1 py-2 text-sm font-medium whitespace-nowrap ${
              currentTab === "all" ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES
            }`}
          >
            All ({allContentLength})
          </Link>
          <Link
            to={`/dashboard/published${params["queueType"] ? `/${params["queueType"]}` : ""}?tab=posts`}
            className={`border-b-2 px-1 py-2 text-sm font-medium whitespace-nowrap ${
              currentTab === "posts" ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES
            }`}
          >
            Posts ({postsLength})
          </Link>
          <Link
            to={`/dashboard/published${params["queueType"] ? `/${params["queueType"]}` : ""}?tab=longform`}
            className={`border-b-2 px-1 py-2 text-sm font-medium whitespace-nowrap ${
              currentTab === "longform"
                ? ACTIVE_TAB_CLASSES
                : INACTIVE_TAB_CLASSES
            }`}
          >
            Longform ({longformPostsLength})
          </Link>
        </nav>
      </div>
    </>
  );
}
