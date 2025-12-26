import { Link, useParams } from "@remix-run/react";

import type { CombinedContent, PostData, LongFormPostData } from "~/features/posts/types";

interface PostTypeTabsProps {
  currentTab: string;
  allContent?: CombinedContent[];
  posts?: PostData[];
  longformPosts?: LongFormPostData[];
  basePath?: string;
}

export default function PostTypeTabs({
  currentTab,
  allContent = [],
  posts = [],
  longformPosts = [],
  basePath = "/dashboard",
}: PostTypeTabsProps) {
  const params = useParams();
  const queueParam = params.queueType ? `/${params.queueType}` : "";

  const getTabClasses = (isActive: boolean) =>
    `whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${
      isActive
        ? "border-blue-500 text-blue-600 dark:text-blue-400"
        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
    }`;

  return (
    <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
      <nav className="-mb-px flex space-x-8" aria-label="Post Types">
        <Link
          to={`${basePath}${queueParam}?tab=all`}
          className={getTabClasses(currentTab === "all")}
        >
          All ({allContent.length})
        </Link>
        <Link
          to={`${basePath}${queueParam}?tab=posts`}
          className={getTabClasses(currentTab === "posts")}
        >
          Posts ({posts.length})
        </Link>
        <Link
          to={`${basePath}${queueParam}?tab=longform`}
          className={getTabClasses(currentTab === "longform")}
        >
          Longform ({longformPosts.length})
        </Link>
      </nav>
    </div>
  );
}
