import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "@remix-run/react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useIsMobile } from "~/lib/hooks/useIsMobile";
import { cn } from "~/lib/utils";

import type { CombinedContent, PostData, LongFormPostData } from "../types";

import {
  CONTENT_MOBILE_BREAKPOINT_PX,
  UNDERLINE_FILTER_FOCUS_CLASS,
} from "./constants";
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
  /** Drafts page: poll drafts count */
  totalPollsCount?: number;
  /** Drafts page: thread drafts count */
  totalThreadsCount?: number;
  /** When true, render without outer border/margin so parent can put queue filter on same line. */
  inRow?: boolean;
  /** When true, always use dropdown (Select) instead of tabs (e.g. in calendar header to save space). */
  forceDropdown?: boolean;
}

/* eslint-disable-next-line sonarjs/cognitive-complexity -- Tab labels mirror many route tab values */
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
  totalPollsCount,
  totalThreadsCount,
  inRow = false,
  forceDropdown = false,
}: PostTypeTabsProps) {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile(CONTENT_MOBILE_BREAKPOINT_PX);
  const useDropdown = isMobile || forceDropdown;
  const queueParam = params["queueType"] ? `/${params["queueType"]}` : "";

  const searchWithTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    return next.toString();
  };

  const getTabClasses = (isActive: boolean) =>
    cn(
      "focus-ring whitespace-nowrap rounded-sm border-b-2 px-1 py-2 text-sm font-medium",
      isActive
        ? "border-border text-text dark:border-brand/50 dark:text-link"
        : "border-transparent text-text-secondary hover:border-border hover:text-text"
    );

  // Use pagination totals if available, otherwise fall back to array lengths
  const allCount = totalContentCount ?? allContent.length;
  const postsCount = totalPostsCount ?? posts.length;
  const repostsCount = totalRepostsCount ?? 0;
  const longformCount = totalLongformCount ?? longformPosts.length;
  const showBulkTab = bulkCount !== undefined;
  const showPollsThreadsTabs =
    totalPollsCount !== undefined && totalThreadsCount !== undefined;
  const pollsCount = totalPollsCount ?? 0;
  const threadsCount = totalThreadsCount ?? 0;

  const wrapperClass = inRow ? "flex-1 min-w-0" : "border-border mb-6 border-b";

  const handleMobileTabChange = (value: string) => {
    navigate(`${basePath}${queueParam}?${searchWithTab(value)}`);
  };

  if (useDropdown) {
    const label =
      currentTab === "all"
        ? `All Types (${allCount})`
        : currentTab === "posts"
          ? `Posts (${postsCount})`
          : currentTab === "polls"
            ? `Polls (${pollsCount})`
            : currentTab === "threads"
              ? `Threads (${threadsCount})`
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
            className={cn(
              "h-9 border-0 border-b-2 border-transparent bg-transparent px-1 py-1.5 text-sm font-medium shadow-none [&>svg]:ml-0",
              UNDERLINE_FILTER_FOCUS_CLASS
            )}
            aria-label="Content type"
          >
            <SelectValue>{label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types ({allCount})</SelectItem>
            <SelectItem value="posts">Posts ({postsCount})</SelectItem>
            {showPollsThreadsTabs ? (
              <>
                <SelectItem value="polls">Polls ({pollsCount})</SelectItem>
                <SelectItem value="threads">
                  Threads ({threadsCount})
                </SelectItem>
              </>
            ) : null}
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
          to={`${basePath}${queueParam}?${searchWithTab("all")}`}
          className={getTabClasses(currentTab === "all")}
        >
          All ({allCount})
        </Link>
        <Link
          to={`${basePath}${queueParam}?${searchWithTab("posts")}`}
          className={getTabClasses(currentTab === "posts")}
        >
          Posts ({postsCount})
        </Link>
        {showPollsThreadsTabs ? (
          <>
            <Link
              to={`${basePath}${queueParam}?${searchWithTab("polls")}`}
              className={getTabClasses(currentTab === "polls")}
            >
              Polls ({pollsCount})
            </Link>
            <Link
              to={`${basePath}${queueParam}?${searchWithTab("threads")}`}
              className={getTabClasses(currentTab === "threads")}
            >
              Threads ({threadsCount})
            </Link>
          </>
        ) : null}
        <Link
          to={`${basePath}${queueParam}?${searchWithTab("longform")}`}
          className={getTabClasses(currentTab === "longform")}
        >
          Articles ({longformCount})
        </Link>
        <Link
          to={`${basePath}${queueParam}?${searchWithTab("reposts")}`}
          className={getTabClasses(currentTab === "reposts")}
        >
          Reposts ({repostsCount})
        </Link>
        {showBulkTab ? (
          <Link
            to={`${basePath}${queueParam}?${searchWithTab("bulk")}`}
            className={getTabClasses(currentTab === "bulk")}
          >
            Bulk ({bulkCount})
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
