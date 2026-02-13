import { Link, useParams } from "@remix-run/react";

import type { CombinedContent, PostData, LongFormPostData } from "../types";
interface PostTypeTabsProps {
  currentTab: string;
  allContent?: CombinedContent[];
  posts?: PostData[];
  longformPosts?: LongFormPostData[];
  basePath?: string;
  // Optional: Use pagination totals instead of array lengths
  totalContentCount?: number;
  totalPostsCount?: number;
  totalRepostsCount?: number;
  totalLongformCount?: number;
}

export default function PostTypeTabs({
  currentTab,
  allContent = [],
  posts = [],
  longformPosts = [],
  basePath = "/dashboard",
  totalContentCount,
  totalPostsCount,
  totalRepostsCount,
  totalLongformCount,
}: PostTypeTabsProps) {
  const params = useParams();
  const queueParam = params["queueType"] ? `/${params["queueType"]}` : "";

  const getTabClasses = (isActive: boolean) =>
    `whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${
      isActive
        ? "border-border text-foreground dark:border-primary dark:text-primary"
        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
    }`;

  // Use pagination totals if available, otherwise fall back to array lengths
  const allCount = totalContentCount ?? allContent.length;
  const postsCount = totalPostsCount ?? posts.length;
  const repostsCount = totalRepostsCount ?? 0;
  const longformCount = totalLongformCount ?? longformPosts.length;

  return (
    <div className="border-border mb-6 border-b">
      <nav className="-mb-px flex space-x-8" aria-label="Post Types">
        <Link
          to={`${basePath}${queueParam}?tab=all`}
          className={getTabClasses(currentTab === "all")}
        >
          All ({allCount})
        </Link>
        <Link
          to={`${basePath}${queueParam}?tab=posts`}
          className={getTabClasses(currentTab === "posts")}
        >
          Posts ({postsCount})
        </Link>
        <Link
          to={`${basePath}${queueParam}?tab=reposts`}
          className={getTabClasses(currentTab === "reposts")}
        >
          Reposts ({repostsCount})
        </Link>
        <Link
          to={`${basePath}${queueParam}?tab=longform`}
          className={getTabClasses(currentTab === "longform")}
        >
          Longform ({longformCount})
        </Link>
      </nav>
    </div>
  );
}
