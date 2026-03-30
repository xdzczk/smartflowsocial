import { useParams, useSearchParams } from "@remix-run/react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  CONTENT_MOBILE_BREAKPOINT_PX,
  MOBILE_FILTER_LABEL_CLASS,
  MOBILE_FILTER_SELECT_TRIGGER_CLASS,
} from "~/features/posts/components/constants";
import type { QueueType } from "~/features/posts/types";
import {
  PublishingFilterRow,
  PublishingQueueFilter,
  PublishingSegmentedControlLinks,
} from "~/features/posts/ui";
import { useIsMobile } from "~/lib/hooks/useIsMobile";

import { buildDraftsSegmentLinkItems } from "../utils/drafts-toolbar-segments";

export interface DraftsToolbarProps {
  currentTab: string;
  basePath?: string;
  queueTypes: QueueType[];
  totalContentCount: number;
  totalPostsCount: number;
  totalPollsCount: number;
  totalThreadsCount: number;
  totalRepostsCount: number;
  totalLongformCount: number;
  bulkCount: number;
  showQueueFilter: boolean;
  showSort: boolean;
  sortConfig: { key: string; direction: "asc" | "desc" };
  onSortChange: (key: string, direction: "asc" | "desc") => void;
}

export function DraftsToolbar({
  currentTab,
  basePath = "/dashboard/drafts",
  queueTypes,
  totalContentCount,
  totalPostsCount,
  totalPollsCount,
  totalThreadsCount,
  totalRepostsCount,
  totalLongformCount,
  bulkCount,
  showQueueFilter,
  showSort,
  sortConfig,
  onSortChange,
}: DraftsToolbarProps) {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile(CONTENT_MOBILE_BREAKPOINT_PX);

  const queuePathSegment = params["queueType"] ? `/${params["queueType"]}` : "";

  const segmentItems = buildDraftsSegmentLinkItems({
    basePath,
    queuePathSegment,
    searchParams,
    totalContentCount,
    totalPostsCount,
    totalPollsCount,
    totalThreadsCount,
    totalRepostsCount,
    totalLongformCount,
    bulkCount,
  });

  const sortControl = showSort ? (
    <div className="flex min-w-0 flex-shrink-0 items-center gap-2">
      <span
        className={`text-muted-foreground hidden text-sm sm:inline ${MOBILE_FILTER_LABEL_CLASS}`}
      >
        Sort
      </span>
      <Select
        value={
          sortConfig.key === "caption"
            ? `caption-${sortConfig.direction}`
            : `date-${sortConfig.direction}`
        }
        onValueChange={(value) => {
          if (
            value === "date-asc" ||
            value === "date-desc" ||
            value === "caption-asc" ||
            value === "caption-desc"
          ) {
            const [key, dir] = value.split("-") as [string, "asc" | "desc"];
            onSortChange(key === "date" ? "updatedAt" : "caption", dir);
          }
        }}
      >
        <SelectTrigger
          className={`border-border h-9 w-[11rem] ${MOBILE_FILTER_SELECT_TRIGGER_CLASS}`}
          aria-label="Sort drafts"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="date-desc">Updated (newest)</SelectItem>
          <SelectItem value="date-asc">Updated (oldest)</SelectItem>
          <SelectItem value="caption-asc">Title (A–Z)</SelectItem>
          <SelectItem value="caption-desc">Title (Z–A)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ) : null;

  return (
    <PublishingFilterRow
      leading={
        <PublishingSegmentedControlLinks
          data-testid="drafts-type-segments"
          ariaLabel="Draft type"
          activeId={currentTab}
          items={segmentItems}
        />
      }
      trailing={
        <>
          {showQueueFilter ? (
            <PublishingQueueFilter
              currentTab={currentTab}
              queueTypes={queueTypes}
              basePath={basePath}
            />
          ) : null}
          {!isMobile ? sortControl : null}
          {isMobile && showSort ? (
            <div className="w-full sm:hidden">{sortControl}</div>
          ) : null}
        </>
      }
    />
  );
}
