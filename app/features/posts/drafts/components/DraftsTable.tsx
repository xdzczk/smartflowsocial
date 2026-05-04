/**
 * Drafts table  -  resume-first layout (desktop table + mobile cards).
 */

import { Link, useFetcher, useNavigate } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MoreHorizontal, Repeat } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type Key,
  type KeyboardEvent,
} from "react";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { EmptyState } from "~/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { postToCombinedContent } from "~/features/posts/combined";
import {
  CONTENT_LIST_CARD_GAP_PX,
  CONTENT_MOBILE_BREAKPOINT_PX,
  MOBILE_FILTER_LABEL_CLASS,
  MOBILE_FILTER_SELECT_TRIGGER_CLASS,
} from "~/features/posts/components/constants";
import { ContentListCard } from "~/features/posts/components/ContentListCard";
import {
  PUBLISHING_CONTENT_KIND_BADGE_CLASS,
  PUBLISHING_LIST_SURFACE_CLASS,
  PUBLISHING_TABLE_ROW_CLASS,
  QueueStatusChip,
} from "~/features/posts/components/publishing-suite";
import {
  getShortDraftComposeUrl,
  getShortDraftEditRedirectPath,
} from "~/features/posts/drafts/utils/draft-editor-navigation";
import {
  buildDraftRowPreview,
  draftTypeLabel,
} from "~/features/posts/drafts/utils/draft-row-preview";
import { draftsKeys } from "~/features/posts/hooks/useDraftsQuery";
import type { PostData } from "~/features/posts/types";
import { getPostRowThumbnailBadge } from "~/features/posts/utils/content-helpers";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { useIsMobile } from "~/lib/hooks/useIsMobile";
import {
  INLINE_ICON_SIZE_CLASS,
  SMALL_ICON_SIZE_CLASS,
} from "~/lib/icon-constants";
import { formatForDisplay, fromISOString } from "~/lib/temporal";

interface Post {
  id: string;
  caption?: string | null;
  content?: string | null;
  createdAt: string;
  updatedAt?: string;
  fileUrl?: string[] | null;
  postType?: string;
  postKind?: string;
  draftMeta?: unknown;
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
  onResume: (post: Post) => void;
  bulkDeleteState: string;
  userTimezone?: string;
  userTimeFormat?: "12h" | "24h";
  onSortChange?: (key: string, direction: "asc" | "desc") => void;
  prefetchSentinelRef?: React.Ref<HTMLDivElement | null>;
  sentinelRef?: React.Ref<HTMLDivElement | null>;
  isFetchingNextPage?: boolean;
  onScrollContainerReady?: (el: HTMLDivElement | null) => void;
  /** When false, mobile sort is shown in DraftsToolbar instead */
  showMobileSortControl?: boolean;
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
    className="bg-surface border-border text-text-secondary hover:text-text cursor-pointer border-b px-3 py-3 text-left text-xs font-medium"
    onClick={() => onRequestSort(sortKey)}
  >
    <span className="text-text font-medium">{label}</span>
    {sortConfig.key === sortKey
      ? sortConfig.direction === "asc"
        ? " ↑"
        : " ↓"
      : null}
  </th>
);

interface DraftsActionData {
  success?: boolean;
  newPostId?: string;
  error?: string;
}

export function DraftsTable({
  posts,
  sortConfig,
  onRequestSort,
  selectedPosts,
  onToggleSelection,
  onToggleSelectAll,
  onResume,
  bulkDeleteState,
  userTimezone = "UTC",
  userTimeFormat = "12h",
  onSortChange,
  prefetchSentinelRef,
  sentinelRef,
  isFetchingNextPage = false,
  onScrollContainerReady,
  showMobileSortControl = true,
}: DraftsTableProps) {
  const navigate = useNavigate();
  const { dateLocale } = useFormattedDate();
  const isMobile = useIsMobile(CONTENT_MOBILE_BREAKPOINT_PX);
  const mobileScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const useDedicatedScroll =
    isMobile && (sentinelRef != null || onScrollContainerReady != null);

  const deleteFetcher = useFetcher<{ success?: boolean }>();
  const draftsActionFetcher = useFetcher<DraftsActionData>();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (
      deleteFetcher.state === "idle" &&
      deleteFetcher.data &&
      "success" in deleteFetcher.data &&
      deleteFetcher.data.success
    ) {
      void queryClient.invalidateQueries({ queryKey: draftsKeys.all });
    }
  }, [deleteFetcher.state, deleteFetcher.data, queryClient]);

  useEffect(() => {
    if (
      draftsActionFetcher.state !== "idle" ||
      !draftsActionFetcher.data?.success
    ) {
      return;
    }
    void queryClient.invalidateQueries({ queryKey: draftsKeys.all });
    if (draftsActionFetcher.data.newPostId) {
      navigate(
        getShortDraftEditRedirectPath(draftsActionFetcher.data.newPostId)
      );
    }
  }, [
    draftsActionFetcher.state,
    draftsActionFetcher.data,
    navigate,
    queryClient,
  ]);

  const combinedContent = posts.map((post) =>
    postToCombinedContent(post as unknown as PostData)
  );

  /* eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual exposes unstable function refs; virtualization is intentional */
  const rowVirtualizer = useVirtualizer({
    count: combinedContent.length,
    getScrollElement: () =>
      useDedicatedScroll && mobileScrollContainerRef.current
        ? mobileScrollContainerRef.current
        : typeof document !== "undefined"
          ? document.documentElement
          : null,
    estimateSize: () => 112 + CONTENT_LIST_CARD_GAP_PX,
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
        userTimeFormat,
        dateLocale
      );
    } catch {
      try {
        const date = new Date(isoString);
        return date.toLocaleString(dateLocale, {
          timeZone: userTimezone,
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: userTimeFormat === "12h",
        });
      } catch {
        return "—";
      }
    }
  };

  const getImageUrls = (fileUrl: string[] | null | undefined) => {
    if (!fileUrl || fileUrl.length === 0) return [];
    if (typeof fileUrl[0] === "string" && fileUrl[0].startsWith("[")) {
      try {
        return JSON.parse(fileUrl[0]) as string[];
      } catch {
        return [];
      }
    }
    return fileUrl;
  };

  if (posts.length === 0) {
    return (
      <div className={PUBLISHING_LIST_SURFACE_CLASS}>
        <EmptyState
          size="lg"
          title="No drafts yet"
          description="Anything saved from the composer will appear here. Use templates to speed up repetitive content workflows."
          action={
            <>
              <Button asChild variant="default" size="sm">
                <Link to="/dashboard/compose">New post</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard/compose?type=article">New article</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard/bulkposts">Bulk posts</Link>
              </Button>
            </>
          }
        />
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <div className={`w-full ${PUBLISHING_LIST_SURFACE_CLASS}`}>
          <table className="min-w-full table-fixed align-middle text-sm">
            <thead>
              <tr>
                <th className="bg-surface border-border text-text-secondary w-10 border-b px-2 py-3 text-center">
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
                <th className="bg-surface border-border text-text-secondary border-b px-3 py-3 text-left text-xs font-medium">
                  Draft
                </th>
                <th className="bg-surface border-border text-text-secondary w-40 border-b px-3 py-3 text-center text-xs font-medium">
                  Queue
                </th>
                <SortableHeader
                  sortKey="updatedAt"
                  label="Updated"
                  sortConfig={sortConfig}
                  onRequestSort={onRequestSort}
                />
                <th className="bg-surface border-border text-text-secondary w-28 border-b px-3 py-3 text-center text-xs font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post, rowIndex) => {
                const preview = buildDraftRowPreview(
                  post as Parameters<typeof buildDraftRowPreview>[0]
                );
                const typeLabel = draftTypeLabel(
                  post as Parameters<typeof draftTypeLabel>[0]
                );
                const resumeUrl = getShortDraftComposeUrl(
                  post.id,
                  post as Parameters<typeof getShortDraftComposeUrl>[1]
                );
                const updatedIso = post.updatedAt ?? post.createdAt;
                const combinedRow = combinedContent[rowIndex];
                const p = post as Post & {
                  repost?: boolean;
                  postKind?: string;
                  postType?: string;
                  signedEvent?: PostData["signedEvent"];
                };
                const isRepost = p.repost === true || p.postKind === "REPOST";
                const rowThumbBadge = getPostRowThumbnailBadge({
                  contentKind: "post",
                  postType: p.postType,
                  signedEvent: p.signedEvent ?? null,
                  repost: isRepost,
                  postKind: p.postKind ?? null,
                });
                const urls = getImageUrls(post.fileUrl);

                const handleRowKeyDown = (
                  e: KeyboardEvent<HTMLTableRowElement>
                ) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onResume(post);
                  }
                };

                return (
                  <tr
                    key={post.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open draft: ${preview.title}`}
                    className={`${PUBLISHING_TABLE_ROW_CLASS} border-border hover:border-border/80 hover:bg-surface-hover/40 motion-fast cursor-pointer border-b last:border-b-0`}
                    onClick={() => onResume(post)}
                    onKeyDown={handleRowKeyDown}
                  >
                    <td className="px-2 py-3 text-center align-middle">
                      <Checkbox
                        id={`draft-select-${post.id}`}
                        checked={selectedPosts.has(post.id)}
                        onCheckedChange={() => onToggleSelection(post.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex gap-3">
                        <div className="relative h-14 w-14 flex-shrink-0">
                          {urls.length > 0 ? (
                            <div className="relative">
                              <img
                                src={urls[0]}
                                alt=""
                                className="h-14 w-14 rounded-md object-cover"
                              />
                              {isRepost ? (
                                <div className="bg-brand absolute -top-0.5 -right-0.5 rounded-full p-0.5">
                                  <Repeat
                                    className={`${SMALL_ICON_SIZE_CLASS} text-brand-on`}
                                    strokeWidth={2}
                                    aria-hidden
                                  />
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="relative">
                              <div className="bg-surface-hover text-text-secondary flex h-14 w-14 items-center justify-center rounded-md text-xs font-medium">
                                {rowThumbBadge}
                              </div>
                              {isRepost ? (
                                <div className="bg-brand absolute -top-0.5 -right-0.5 rounded-full p-0.5">
                                  <Repeat
                                    className={`${SMALL_ICON_SIZE_CLASS} text-brand-on`}
                                    strokeWidth={2}
                                    aria-hidden
                                  />
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
                          <div className="flex w-[6.5rem] shrink-0 flex-col gap-0.5">
                            <span
                              className={PUBLISHING_CONTENT_KIND_BADGE_CLASS}
                            >
                              {typeLabel}
                            </span>
                            {preview.mediaLine ? (
                              <span className="text-text-secondary text-xs leading-tight">
                                {preview.mediaLine}
                              </span>
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-text group-hover:text-link-hover pr-2 leading-snug font-semibold">
                              {preview.title}
                            </p>
                            <p
                              className={`text-text-secondary mt-1 line-clamp-2 text-sm leading-relaxed ${preview.subtitle ? "" : "min-h-[1.25rem]"}`}
                            >
                              {preview.subtitle || "\u00a0"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center align-middle">
                      <div className="flex justify-center">
                        {combinedRow ? (
                          <QueueStatusChip
                            queueType={combinedRow.queueType}
                            mode="draft"
                          />
                        ) : null}
                      </div>
                    </td>
                    <td className="text-text-secondary px-3 py-3 align-middle text-xs whitespace-nowrap">
                      {formatDate(updatedIso)}
                    </td>
                    <td className="px-3 py-3 text-center align-middle">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="focus-ring border-border bg-surface text-text hover:bg-surface-hover inline-flex h-8 w-8 items-center justify-center rounded-lg border"
                            aria-label="Actions"
                          >
                            <MoreHorizontal
                              className={INLINE_ICON_SIZE_CLASS}
                            />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenuItem asChild>
                            <Link to={resumeUrl}>Continue editing</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              const fd = new FormData();
                              fd.set("_action", "duplicateDraftPost");
                              fd.set("postId", post.id);
                              draftsActionFetcher.submit(fd, {
                                method: "post",
                                action: "/dashboard/drafts",
                              });
                            }}
                          >
                            Duplicate draft
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              const name = window.prompt(
                                "Template name",
                                "Template from draft"
                              );
                              if (name === null) return;
                              const fd = new FormData();
                              fd.set("_action", "convertDraftToTemplate");
                              fd.set("postId", post.id);
                              fd.set("templateName", name);
                              draftsActionFetcher.submit(fd, {
                                method: "post",
                                action: "/dashboard/drafts",
                              });
                            }}
                          >
                            Convert to template
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <deleteFetcher.Form
                            method="post"
                            action="/dashboard/drafts"
                          >
                            <input
                              type="hidden"
                              name="postId"
                              value={post.id}
                            />
                            <input
                              type="hidden"
                              name="_action"
                              value="delete"
                            />
                            <DropdownMenuItem asChild>
                              <button
                                type="submit"
                                disabled={
                                  deleteFetcher.state !== "idle" ||
                                  bulkDeleteState !== "idle"
                                }
                                className="text-danger focus:text-danger w-full"
                              >
                                {deleteFetcher.state !== "idle" &&
                                deleteFetcher.formData?.get("postId") ===
                                  post.id
                                  ? "Deleting..."
                                  : "Delete draft"}
                              </button>
                            </DropdownMenuItem>
                          </deleteFetcher.Form>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isMobile ? (
        <div className="block flex min-h-0 flex-1 flex-col md:hidden">
          {showMobileSortControl && onSortChange ? (
            <div className="cluster mb-3">
              <span
                className={`text-text-secondary text-sm ${MOBILE_FILTER_LABEL_CLASS}`}
              >
                Sort:
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
                    const [key, dir] = value.split("-") as [
                      string,
                      "asc" | "desc",
                    ];
                    onSortChange(key === "date" ? "updatedAt" : "caption", dir);
                  }
                }}
              >
                <SelectTrigger
                  className={`w-[11rem] ${MOBILE_FILTER_SELECT_TRIGGER_CLASS}`}
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
                            onResumeDraft={() =>
                              onResume(item.originalData as unknown as Post)
                            }
                            deleteFetcher={
                              deleteFetcher as Parameters<
                                typeof ContentListCard
                              >[0]["deleteFetcher"]
                            }
                            draftsActionFetcher={
                              draftsActionFetcher as Parameters<
                                typeof ContentListCard
                              >[0]["draftsActionFetcher"]
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
                    <div className="text-text-secondary py-4 text-center text-sm">
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
                      onResumeDraft={() =>
                        onResume(item.originalData as unknown as Post)
                      }
                      deleteFetcher={
                        deleteFetcher as Parameters<
                          typeof ContentListCard
                        >[0]["deleteFetcher"]
                      }
                      draftsActionFetcher={
                        draftsActionFetcher as Parameters<
                          typeof ContentListCard
                        >[0]["draftsActionFetcher"]
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
