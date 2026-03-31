import { Link } from "@remix-run/react";
import { MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";

import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type { LongFormPostType } from "~/features/posts/server";
import type { LongFormPostData, PostFetcher } from "~/features/posts/types";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";

import { getDefaultSortKey } from "../utils/longform-listing-utils";

export interface LongFormTableDesktopProps {
  filteredPosts: Array<LongFormPostType | LongFormPostData>;
  selectedPosts: Set<string>;
  togglePostSelection: (id: string) => void;
  toggleSelectAll: () => void;
  sortConfig: { key: string; direction: "asc" | "desc" };
  requestSort: (key: string) => void;
  type: "draft" | "scheduled" | "published";
  formatDateCell: (
    dateInput: string | Date | number | undefined,
    userTimezone: string,
    userTimeFormat: "12h" | "24h",
    dateLocale: string
  ) => string;
  getReadingTime: (content?: string) => string;
  getStatusBadge: (type: "draft" | "scheduled" | "published") => ReactNode;
  countdowns: Record<string, string>;
  onPostSelect?: (post: LongFormPostType | LongFormPostData) => void;
  onEditPost?: (post: LongFormPostType | LongFormPostData) => void;
  onReschedulePost?: (post: LongFormPostType | LongFormPostData) => void;
  deleteFetcher: PostFetcher;
  bulkDeleteFetcher: PostFetcher;
  nostrUrls: { articleUrl: (idOrNaddr: string) => string };
  longformRepostFetcher?: PostFetcher;
  longformQuoteFetcher?: PostFetcher;
  getFetcherFormData: (
    fetcher: PostFetcher | undefined
  ) => FormData | null | undefined;
  userTimezone: string;
  userTimeFormat: "12h" | "24h";
  dateLocale: string;
}

export function LongFormTableDesktop({
  filteredPosts,
  selectedPosts,
  togglePostSelection,
  toggleSelectAll,
  sortConfig,
  requestSort,
  type,
  formatDateCell,
  getReadingTime,
  getStatusBadge,
  countdowns,
  onPostSelect,
  onEditPost,
  onReschedulePost,
  deleteFetcher,
  bulkDeleteFetcher,
  nostrUrls,
  longformRepostFetcher,
  longformQuoteFetcher,
  getFetcherFormData,
  userTimezone,
  userTimeFormat,
  dateLocale,
}: LongFormTableDesktopProps) {
  const dateSortKey = getDefaultSortKey(type);

  return (
    <div className="dark:border-border bg-card border-border min-w-full overflow-x-auto rounded border">
      <table className="min-w-full align-middle text-sm whitespace-nowrap">
        <thead>
          <tr>
            <th className="dark:bg-card dark:border-border dark:text-foreground bg-muted text-foreground px-3 py-4 text-center font-semibold">
              <Checkbox
                id="longform-select-all"
                checked={
                  filteredPosts.length > 0
                    ? selectedPosts.size === filteredPosts.length
                    : false
                }
                onCheckedChange={() => toggleSelectAll()}
              />
            </th>
            <th className="dark:bg-card dark:border-border bg-muted/75 text-foreground dark:text-foreground px-3 py-4 text-left font-semibold">
              Cover
            </th>
            <th
              className="dark:bg-card dark:border-border bg-muted/75 text-foreground dark:text-foreground cursor-pointer px-3 py-4 text-left font-semibold"
              onClick={() => requestSort("title")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  requestSort("title");
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Sort by title"
            >
              Title{" "}
              {sortConfig.key === "title"
                ? sortConfig.direction === "asc"
                  ? "↑"
                  : "↓"
                : null}
            </th>
            <th className="dark:bg-card dark:border-border bg-muted/75 text-foreground dark:text-foreground px-3 py-4 text-left font-semibold">
              Summary
            </th>
            <th
              className="dark:bg-card dark:border-border bg-muted/75 text-foreground dark:text-foreground cursor-pointer px-3 py-4 text-left font-semibold"
              onClick={() => requestSort(dateSortKey)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  requestSort(dateSortKey);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Sort by ${type === "published" ? "published date" : type === "scheduled" ? "scheduled date" : "created date"}`}
            >
              {type === "published"
                ? "Published"
                : type === "scheduled"
                  ? "Scheduled For"
                  : "Created"}{" "}
              {sortConfig.key === dateSortKey
                ? sortConfig.direction === "asc"
                  ? "↑"
                  : "↓"
                : null}
            </th>
            <th className="dark:bg-card dark:border-border dark:text-foreground bg-muted text-foreground px-3 py-4 text-center font-semibold">
              Reading Time
            </th>
            {type === "scheduled" ? (
              <th className="dark:bg-card dark:border-border dark:text-foreground bg-muted text-foreground px-3 py-4 text-center font-semibold">
                Time Remaining
              </th>
            ) : null}
            <th className="dark:bg-card dark:border-border dark:text-foreground bg-muted text-foreground px-3 py-4 text-center font-semibold">
              Status
            </th>
            <th className="dark:bg-card dark:border-border dark:text-foreground bg-muted text-foreground px-3 py-4 text-center font-semibold">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredPosts.map((post) => {
            const dateInput =
              type === "published"
                ? post.publishedAt
                : type === "scheduled"
                  ? (post as { scheduledAtUtc?: unknown }).scheduledAtUtc
                  : post.createdAt;
            const eventId =
              post.nostrEventId ??
              (post.signedEvent &&
              typeof post.signedEvent === "object" &&
              "id" in post.signedEvent
                ? (post.signedEvent as { id?: string }).id
                : undefined);

            return (
              <tr
                key={post.id}
                className="dark:even:bg-muted/35 dark:hover:bg-muted even:bg-muted/50 hover:bg-muted cursor-pointer"
                onClick={() => onPostSelect?.(post)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && onPostSelect) {
                    e.preventDefault();
                    onPostSelect(post);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Select ${post.title ?? "post"}`}
              >
                <td className="p-3 text-center">
                  <Checkbox
                    id={`longform-select-${post.id}`}
                    checked={selectedPosts.has(post.id)}
                    onCheckedChange={() => togglePostSelection(post.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="p-3">
                  {post.image ? (
                    <img
                      src={post.image}
                      alt="Cover"
                      className="h-12 w-16 rounded object-cover"
                    />
                  ) : (
                    <div className="dark:bg-muted dark:text-muted-foreground bg-muted text-muted-foreground flex h-12 w-16 items-center justify-center rounded text-xs font-medium">
                      ARTICLE
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <p className="font-medium">
                    {post.title && post.title.length > 40
                      ? post.title.substring(0, 40) + "..."
                      : (post.title ?? "Untitled")}
                  </p>
                </td>
                <td className="max-w-xs p-3">
                  <p className="dark:text-muted-foreground text-foreground line-clamp-2 text-sm">
                    {post.summary && post.summary.length > 60
                      ? post.summary.substring(0, 60) + "..."
                      : (post.summary ?? "No summary")}
                  </p>
                </td>
                <td className="p-3">
                  {formatDateCell(
                    dateInput as string | Date | number | undefined,
                    userTimezone,
                    userTimeFormat,
                    dateLocale
                  )}
                </td>
                <td className="p-3 text-center">
                  <span className="dark:text-muted-foreground text-muted-foreground text-sm">
                    {getReadingTime(post.content ?? undefined)}
                  </span>
                </td>
                {type === "scheduled" ? (
                  <td className="p-3 text-center">
                    <div className="text-muted-foreground text-sm font-medium">
                      {countdowns[post.id] ?? "—"}
                    </div>
                  </td>
                ) : null}
                <td className="p-3 text-center">{getStatusBadge(type)}</td>
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
                      {type === "draft" ? (
                        <DropdownMenuItem asChild>
                          <Link
                            to={`/dashboard/drafts/longform/edit/${post.id}`}
                          >
                            Edit
                          </Link>
                        </DropdownMenuItem>
                      ) : null}
                      {type === "scheduled" && onEditPost ? (
                        <>
                          <DropdownMenuItem onSelect={() => onEditPost(post)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => onReschedulePost?.(post)}
                          >
                            Reschedule
                          </DropdownMenuItem>
                          <deleteFetcher.Form method="post">
                            <input
                              type="hidden"
                              name="postId"
                              value={post.id}
                            />
                            <input
                              type="hidden"
                              name="_action"
                              value="moveToDraft"
                            />
                            <input type="hidden" name="type" value="longform" />
                            <DropdownMenuItem asChild>
                              <button
                                type="submit"
                                disabled={
                                  deleteFetcher.state !== "idle" ||
                                  bulkDeleteFetcher.state !== "idle"
                                }
                              >
                                {deleteFetcher.state !== "idle" &&
                                deleteFetcher.formData?.get("_action") ===
                                  "moveToDraft" &&
                                /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- formData can be undefined when idle */
                                deleteFetcher.formData?.get("postId") ===
                                  post.id
                                  ? "Moving..."
                                  : "Move to drafts"}
                              </button>
                            </DropdownMenuItem>
                          </deleteFetcher.Form>
                        </>
                      ) : null}
                      {type === "published" && eventId ? (
                        <>
                          <DropdownMenuItem asChild>
                            <Link
                              to={nostrUrls.articleUrl(String(eventId))}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View Article
                            </Link>
                          </DropdownMenuItem>
                          {longformRepostFetcher
                            ? (() => {
                                const fetcher = longformRepostFetcher;
                                const formData = getFetcherFormData(fetcher);
                                return (
                                  <fetcher.Form method="post">
                                    <input
                                      type="hidden"
                                      name="postId"
                                      value={post.id}
                                    />
                                    <input
                                      type="hidden"
                                      name="_action"
                                      value="longformRepost"
                                    />
                                    <DropdownMenuItem asChild>
                                      <button
                                        type="submit"
                                        disabled={
                                          fetcher.state !== "idle" ||
                                          (formData
                                            ? (formData.get("postId") as
                                                | string
                                                | null) === post.id
                                            : false)
                                        }
                                      >
                                        {fetcher.state !== "idle" &&
                                        (formData
                                          ? (formData.get("postId") as
                                              | string
                                              | null) === post.id
                                          : false)
                                          ? "Reposting..."
                                          : "Repost"}
                                      </button>
                                    </DropdownMenuItem>
                                  </fetcher.Form>
                                );
                              })()
                            : null}
                          {longformQuoteFetcher
                            ? (() => {
                                const fetcher = longformQuoteFetcher;
                                const formData = getFetcherFormData(fetcher);
                                return (
                                  <fetcher.Form method="post">
                                    <input
                                      type="hidden"
                                      name="postId"
                                      value={post.id}
                                    />
                                    <input
                                      type="hidden"
                                      name="_action"
                                      value="longformQuote"
                                    />
                                    <DropdownMenuItem asChild>
                                      <button
                                        type="submit"
                                        disabled={
                                          fetcher.state !== "idle" ||
                                          (formData
                                            ? (formData.get("postId") as
                                                | string
                                                | null) === post.id
                                            : false)
                                        }
                                      >
                                        {fetcher.state !== "idle" &&
                                        (formData
                                          ? (formData.get("postId") as
                                              | string
                                              | null) === post.id
                                          : false)
                                          ? "Quoting..."
                                          : "Quote Post"}
                                      </button>
                                    </DropdownMenuItem>
                                  </fetcher.Form>
                                );
                              })()
                            : null}
                        </>
                      ) : null}
                      <DropdownMenuSeparator />
                      <deleteFetcher.Form method="post">
                        <input type="hidden" name="postId" value={post.id} />
                        <input
                          type="hidden"
                          name="_action"
                          value="deleteLongForm"
                        />
                        <DropdownMenuItem asChild>
                          <button
                            type="submit"
                            disabled={
                              deleteFetcher.state !== "idle" ||
                              bulkDeleteFetcher.state !== "idle"
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
