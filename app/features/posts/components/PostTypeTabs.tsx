import { Link, useNavigate, useParams } from "@remix-run/react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useIsMobile } from "~/lib/hooks/useIsMobile";

import type { CombinedContent, PostData, LongFormPostData } from "../types";

import { CONTENT_MOBILE_BREAKPOINT_PX } from "./constants";
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
  /** When set, show a fifth "Bulk (n)" tab (e.g. for Drafts page). */
  bulkCount?: number;
  /** When true, render without outer border/margin so parent can put queue filter on same line. */
  inRow?: boolean;
  /** When true, always use dropdown (Select) instead of tabs (e.g. in calendar header to save space). */
  forceDropdown?: boolean;
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
  bulkCount,
  inRow = false,
  forceDropdown = false,
}: PostTypeTabsProps) {
  const params = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile(CONTENT_MOBILE_BREAKPOINT_PX);
  const useDropdown = isMobile || forceDropdown;
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
  const showBulkTab = bulkCount !== undefined;

  const wrapperClass = inRow ? "flex-1 min-w-0" : "border-border mb-6 border-b";

  const handleMobileTabChange = (value: string) => {
    navigate(`${basePath}${queueParam}?tab=${value}`);
  };

  if (useDropdown) {
    const label =
      currentTab === "all"
        ? `All Types (${allCount})`
        : currentTab === "posts"
          ? `Posts (${postsCount})`
          : currentTab === "longform"
            ? `Articles (${longformCount})`
            : currentTab === "reposts"
              ? `Reposts (${repostsCount})`
              : showBulkTab && currentTab === "bulk"
                ? `Bulk (${bulkCount})`
                : currentTab;
    return (
      <div className={wrapperClass}>
        <Select value={currentTab} onValueChange={handleMobileTabChange}>
          <SelectTrigger
            className="h-9 border-0 border-b-2 border-transparent bg-transparent px-1 py-1.5 text-xs font-medium shadow-none focus:ring-0 focus:ring-offset-0 [&>svg]:ml-0"
            aria-label="Content type"
          >
            <SelectValue>{label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types ({allCount})</SelectItem>
            <SelectItem value="posts">Posts ({postsCount})</SelectItem>
            <SelectItem value="longform">Articles ({longformCount})</SelectItem>
            <SelectItem value="reposts">Reposts ({repostsCount})</SelectItem>
            {showBulkTab ? (
              <SelectItem value="bulk">Bulk ({bulkCount})</SelectItem>
            ) : null}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <nav className="-mb-px flex space-x-6" aria-label="Post Types">
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
          to={`${basePath}${queueParam}?tab=longform`}
          className={getTabClasses(currentTab === "longform")}
        >
          Articles ({longformCount})
        </Link>
        <Link
          to={`${basePath}${queueParam}?tab=reposts`}
          className={getTabClasses(currentTab === "reposts")}
        >
          Reposts ({repostsCount})
        </Link>
        {showBulkTab ? (
          <Link
            to={`${basePath}${queueParam}?tab=bulk`}
            className={getTabClasses(currentTab === "bulk")}
          >
            Bulk ({bulkCount})
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
