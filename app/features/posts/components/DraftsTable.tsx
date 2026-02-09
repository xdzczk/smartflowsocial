/**
 * Drafts table component
 */

import { Link, useFetcher } from "@remix-run/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MoreHorizontal } from "lucide-react";
import { useRef, useState, type Key } from "react";

import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useIsMobile } from "~/lib/hooks/useIsMobile";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import { formatForDisplay, fromISOString } from "~/lib/temporal";

import { postToCombinedContent } from "../combined";
import { getQueueColor, getQueueColorBundle } from "../queue-colors";
import type { PostData } from "../types";

import {
  CONTENT_LIST_CARD_GAP_PX,
  CONTENT_MOBILE_BREAKPOINT_PX,
} from "./constants";
import { ContentListCard } from "./ContentListCard";

interface Post {
  id: string;
  caption?: string | null;
  createdAt: string;
  fileUrl?: string[] | null;
  queueType?: {
    name: string;
    color?: string | null;
    colorToken?: string | null;
  } | null;
}

interface DraftsTableProps {
  posts: Post[];
  sortConfig: { key: string; direction: "asc" | "desc" };
  onRequestSort: (key: string) => void;
  selectedPosts: Set<string>;
  onToggleSelection: (postId: string) => void;
  onToggleSelectAll: () => void;
  onPostClick: (post: Post) => void;
  bulkDeleteState: string;
  userTimezone?: string;
  userTimeFormat?: "12h" | "24h";
  onSortChange?: (key: string, direction: "asc" | "desc") => void;
  prefetchSentinelRef?: React.Ref<HTMLDivElement | null>;
  sentinelRef?: React.Ref<HTMLDivElement | null>;
  isFetchingNextPage?: boolean;
  onScrollContainerReady?: (el: HTMLDivElement | null) => void;
}

interface SortableHeaderProps {
  sortKey: string;
  label: string;
  sortConfig: { key: string; direction: "asc" | "desc" };
  onRequestSort: (key: string) => void;
}

const SortableHeader = ({
  sortKey,
  label,
  sortConfig,
  onRequestSort,
}: SortableHeaderProps) => (
  <th
    className="bg-card border-border text-foreground cursor-pointer border-b px-3 py-4 text-left font-semibold"
    onClick={() => onRequestSort(sortKey)}
  >
    {label}{" "}
    {sortConfig.key === sortKey
      ? sortConfig.direction === "asc"
        ? "↑"
        : "↓"
      : null}
  </th>
);

export function DraftsTable({
  posts,
  sortConfig,
  onRequestSort,
  selectedPosts,
  onToggleSelection,
  onToggleSelectAll,
  onPostClick,
  bulkDeleteState,
  userTimezone = "UTC",
  userTimeFormat = "12h",
  onSortChange,
  prefetchSentinelRef,
  sentinelRef,
  isFetchingNextPage = false,
  onScrollContainerReady,
}: DraftsTableProps) {
  const isMobile = useIsMobile(CONTENT_MOBILE_BREAKPOINT_PX);
  const mobileScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const useDedicatedScroll =
    isMobile && (sentinelRef != null || onScrollContainerReady != null);

  const deleteFetcher = useFetcher();
  const combinedContent = posts.map((post) =>
    postToCombinedContent(post as unknown as PostData)
  );
  // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer is not memoization-safe by design
  const rowVirtualizer = useVirtualizer({
    count: combinedContent.length,
    getScrollElement: () =>
      useDedicatedScroll && mobileScrollContainerRef.current
        ? mobileScrollContainerRef.current
        : typeof document !== "undefined"
          ? document.documentElement
          : null,
    estimateSize: () => 98 + CONTENT_LIST_CARD_GAP_PX,
    overscan: 3,
    getItemKey: (index) => combinedContent[index]?.id ?? String(index),
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const [openMenuRowKey, setOpenMenuRowKey] = useState<Key | null>(null);

  const formatDate = (isoString: string) => {
    try {
      const zoned = fromISOString(isoString, "UTC");
      const userZoned = zoned.withTimeZone(userTimezone);
      return formatForDisplay(
        userZoned,
        userTimezone,
        {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        },
        userTimeFormat
      );
    } catch {
      // Fallback - still use Temporal for consistency
      try {
        const zoned = fromISOString(isoString, "UTC");
        const userZoned = zoned.withTimeZone(userTimezone);
        return formatForDisplay(
          userZoned,
          userTimezone,
          {
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          },
          userTimeFormat
        );
      } catch {
        // Final fallback
        const date = new Date(isoString);
        return date.toLocaleString("en-US", {
          timeZone: userTimezone,
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: userTimeFormat === "12h",
        });
      }
    }
  };

  const getImageUrls = (fileUrl: string[] | null | undefined) => {
    if (!fileUrl || fileUrl.length === 0) return [];

    if (typeof fileUrl[0] === "string" && fileUrl[0].startsWith("[")) {
      try {
        return JSON.parse(fileUrl[0]) as string[];
      } catch (_e) {
        return [];
      }
    }

    return fileUrl;
  };

  return (
    <>
      <div className="hidden md:block">
        <div className="border-border bg-card min-w-full overflow-x-auto rounded border">
          <table className="min-w-full align-middle text-sm whitespace-nowrap">
            <thead>
              <tr>
                <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
                  <Checkbox
                    id="draft-select-all"
                    checked={
                      posts.length > 0
                        ? selectedPosts.size === posts.length
                        : false
                    }
                    onCheckedChange={() => onToggleSelectAll()}
                  />
                </th>
                <th className="bg-card border-border text-foreground border-b px-3 py-4 text-left font-semibold">
                  Media
                </th>
                <SortableHeader
                  sortKey="caption"
                  label="Caption"
                  sortConfig={sortConfig}
                  onRequestSort={onRequestSort}
                />
                <SortableHeader
                  sortKey="createdAt"
                  label="Created"
                  sortConfig={sortConfig}
                  onRequestSort={onRequestSort}
                />
                <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
                  Queue
                </th>
                <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
                  Status
                </th>
                <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr
                  key={post.id}
                  className="border-border dark:hover:bg-muted hover:bg-muted cursor-pointer border-b"
                  onClick={() => onPostClick(post)}
                >
                  <td className="p-3 text-center">
                    <Checkbox
                      id={`draft-select-${post.id}`}
                      checked={selectedPosts.has(post.id)}
                      onCheckedChange={() => onToggleSelection(post.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="p-3">
                    {post.fileUrl && post.fileUrl.length > 0 ? (
                      <img
                        src={getImageUrls(post.fileUrl)[0]}
                        alt="Post preview"
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded text-xs font-medium">
                        TEXT
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <p className="font-medium">{post.caption ?? "—"}</p>
                  </td>
                  <td className="p-3">{formatDate(post.createdAt)}</td>
                  <td className="p-3 text-center">
                    {post.queueType?.colorToken ? (
                      (() => {
                        const bundle = getQueueColorBundle(
                          post.queueType.colorToken
                        );
                        return (
                          <div
                            className="inline-flex rounded-full border-2 px-3 py-1 text-xs leading-4 font-semibold shadow-sm"
                            style={{
                              backgroundColor: bundle.surface,
                              color: bundle.accent,
                              borderColor: bundle.accent,
                            }}
                          >
                            {post.queueType.name || "unassigned"}
                          </div>
                        );
                      })()
                    ) : (
                      <div
                        className={`inline-flex rounded-full border-2 px-3 py-1 text-xs leading-4 font-semibold ${(() => {
                          const colors = getQueueColor(
                            post.queueType?.name ?? "unassigned",
                            post.queueType?.colorToken
                          );
                          return `${colors.bg} ${colors.text} ${colors.border}`;
                        })()} shadow-sm`}
                      >
                        {post.queueType?.name ?? "unassigned"}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <div className="bg-muted text-foreground inline-flex rounded-full border border-transparent px-2 py-1 text-xs leading-4 font-semibold">
                      Draft
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="border-border bg-card text-foreground hover:bg-muted focus:ring-ring inline-flex h-8 w-8 items-center justify-center rounded-lg border focus:ring-2 focus:outline-none"
                          aria-label="Actions"
                        >
                          <MoreHorizontal className={INLINE_ICON_SIZE_CLASS} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenuItem asChild>
                          <Link to={`/dashboard/drafts/edit/${post.id}`}>
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <deleteFetcher.Form method="post">
                          <input type="hidden" name="postId" value={post.id} />
                          <input type="hidden" name="_action" value="delete" />
                          <DropdownMenuItem asChild>
                            <button
                              type="submit"
                              disabled={
                                deleteFetcher.state !== "idle" ||
                                bulkDeleteState !== "idle"
                              }
                              className="text-destructive focus:text-destructive"
                            >
                              {deleteFetcher.state !== "idle" &&
                              deleteFetcher.formData?.get("postId") === post.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </DropdownMenuItem>
                        </deleteFetcher.Form>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isMobile ? (
        <div className="block flex min-h-0 flex-1 flex-col md:hidden">
          {onSortChange ? (
            <div className="mb-3 flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Sort:</span>
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
                    const [key, dir] = value.split("-") as [
                      string,
                      "asc" | "desc",
                    ];
                    onSortChange(key === "date" ? "createdAt" : "caption", dir);
                  }
                }}
              >
                <SelectTrigger className="w-[11rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Date (newest first)</SelectItem>
                  <SelectItem value="date-asc">Date (oldest first)</SelectItem>
                  <SelectItem value="caption-asc">Title (A–Z)</SelectItem>
                  <SelectItem value="caption-desc">Title (Z–A)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {useDedicatedScroll ? (
            <div
              ref={(el) => {
                mobileScrollContainerRef.current = el;
                onScrollContainerReady?.(el ?? null);
              }}
              className="min-h-0 flex-1 overflow-auto"
            >
              {combinedContent.length > 0 ? (
                <>
                  <div
                    style={{
                      height: rowVirtualizer.getTotalSize(),
                      position: "relative",
                      width: "100%",
                    }}
                  >
                    {virtualItems.map((virtualRow) => {
                      const item = combinedContent[virtualRow.index];
                      if (!item) return null;
                      return (
                        <div
                          key={virtualRow.key}
                          data-index={virtualRow.index}
                          className="pb-2"
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${virtualRow.start}px)`,
                            zIndex:
                              openMenuRowKey === virtualRow.key
                                ? 50
                                : undefined,
                          }}
                        >
                          <ContentListCard
                            item={item}
                            type="draft"
                            userTimezone={userTimezone}
                            userTimeFormat={userTimeFormat}
                            showBulkActions={true}
                            selectedItems={selectedPosts}
                            onToggleSelection={onToggleSelection}
                            onPostSelect={(content) =>
                              onPostClick(
                                content.originalData as unknown as Post
                              )
                            }
                            deleteFetcher={
                              deleteFetcher as Parameters<
                                typeof ContentListCard
                              >[0]["deleteFetcher"]
                            }
                            onMenuOpenChange={(open) =>
                              setOpenMenuRowKey(open ? virtualRow.key : null)
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                  {prefetchSentinelRef ? (
                    <div ref={prefetchSentinelRef} className="h-4 w-full" />
                  ) : null}
                  {sentinelRef ? (
                    <div ref={sentinelRef} className="h-4 w-full" />
                  ) : null}
                  {isFetchingNextPage ? (
                    <div className="text-muted-foreground py-4 text-center text-sm">
                      Loading more...
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : combinedContent.length > 0 ? (
            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                position: "relative",
                width: "100%",
              }}
            >
              {virtualItems.map((virtualRow) => {
                const item = combinedContent[virtualRow.index];
                if (!item) return null;
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    className="pb-2"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                      zIndex:
                        openMenuRowKey === virtualRow.key ? 50 : undefined,
                    }}
                  >
                    <ContentListCard
                      item={item}
                      type="draft"
                      userTimezone={userTimezone}
                      userTimeFormat={userTimeFormat}
                      showBulkActions={true}
                      selectedItems={selectedPosts}
                      onToggleSelection={onToggleSelection}
                      onPostSelect={(content) =>
                        onPostClick(content.originalData as unknown as Post)
                      }
                      deleteFetcher={
                        deleteFetcher as Parameters<
                          typeof ContentListCard
                        >[0]["deleteFetcher"]
                      }
                      onMenuOpenChange={(open) =>
                        setOpenMenuRowKey(open ? virtualRow.key : null)
                      }
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
