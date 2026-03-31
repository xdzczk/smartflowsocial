import { useLoaderData } from "@remix-run/react";
import { Search, X } from "lucide-react";
import { useState } from "react";

import type { PostData } from "~/features/posts/types";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { formatForDisplay, fromDate } from "~/lib/temporal";

const INVALID_DATE = "Invalid date";

interface ScheduledPostsLoaderData {
  scheduledPosts: PostData[];
}

export default function ScheduledPosts() {
  const { scheduledPosts } = useLoaderData<ScheduledPostsLoaderData>();
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
  const { userTimezone, userTimeFormat, dateLocale } = useFormattedDate();

  return (
    <>
      <div>
        {/* Tables: With Heading and Search */}
        <div className="mt-5 mb-5 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div>
            <h3 className="mb-1 font-semibold">Scheduled Posts</h3>
            <h4 className="text-muted-foreground text-sm font-medium">
              You have{" "}
              <span className="text-muted-foreground">
                {scheduledPosts.length} scheduled posts
              </span>
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full">
              <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 my-px ml-px flex w-10 items-center justify-center rounded-l">
                <Search
                  className="inline-block size-5"
                  strokeWidth={INLINE_ICON_STROKE}
                  aria-hidden
                />
              </div>
              <input
                type="text"
                id="search"
                name="search"
                className="border-border placeholder-muted-foreground dark:border-border dark:bg-card dark:focus:border-primary focus:border-primary focus:ring-ring/50 block w-full rounded-lg border py-2 pr-3 pl-10 text-sm leading-6 focus:ring"
                placeholder="Search posts.."
              />
            </div>
          </div>
        </div>
        {/* Responsive Table Container */}
        <div className="bg-card border-border min-w-full overflow-x-auto rounded border">
          {/* Table */}
          <table className="min-w-full align-middle text-sm whitespace-nowrap">
            {/* Table Header */}
            <thead>
              <tr>
                <th className="bg-muted text-foreground dark:bg-card dark:border-border dark:text-foreground px-3 py-4 text-left font-semibold">
                  Media
                </th>
                <th className="bg-muted text-foreground dark:bg-card dark:border-border dark:text-foreground px-3 py-4 text-left font-semibold">
                  Caption
                </th>
                <th className="bg-muted text-foreground dark:bg-card dark:border-border dark:text-foreground px-3 py-4 text-left font-semibold">
                  Type
                </th>
                <th className="bg-muted text-foreground dark:bg-card dark:border-border dark:text-foreground px-3 py-4 text-left font-semibold">
                  Scheduled For
                </th>
                <th className="bg-muted text-foreground dark:bg-card dark:border-border dark:text-foreground px-3 py-4 text-center font-semibold">
                  Status
                </th>
                <th className="bg-muted text-foreground dark:bg-card dark:border-border dark:text-foreground px-3 py-4 text-center font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            {/* END Table Header */}

            {/* Table Body */}
            <tbody>
              {scheduledPosts.length > 0 ? (
                scheduledPosts.map((post) => {
                  // Safely parse the fileUrl and get the first image if it exists
                  let firstImage: string | undefined;
                  if (post.fileUrl.length > 0) {
                    try {
                      const firstFileUrl = post.fileUrl[0];
                      if (!firstFileUrl) return;
                      const parsed = JSON.parse(firstFileUrl) as string[];
                      firstImage = parsed[0];
                    } catch (_error) {
                      firstImage = post.fileUrl[0];
                    }
                  }

                  return (
                    <tr
                      key={post.id}
                      className="dark:even:bg-muted/35 dark:hover:bg-muted even:bg-muted/50 hover:bg-muted"
                    >
                      <td className="p-3">
                        <div className="size-12 overflow-hidden rounded-lg">
                          {firstImage ? (
                            <img
                              src={firstImage}
                              alt={post.caption ?? "Post media"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="dark:bg-muted bg-muted flex h-full w-full items-center justify-center">
                              <span className="text-muted-foreground dark:text-foreground text-xs">
                                Text
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <p className="font-medium">
                          {post.caption ?? "No caption"}
                        </p>
                      </td>
                      <td className="dark:text-muted-foreground text-muted-foreground p-3">
                        {post.postType}
                      </td>
                      <td className="p-3">
                        {(() => {
                          try {
                            if (!post.scheduledAtUtc) return INVALID_DATE;
                            const rawScheduledAtUtc =
                              post.scheduledAtUtc as unknown;
                            const scheduledAtUtc =
                              rawScheduledAtUtc instanceof Date
                                ? rawScheduledAtUtc
                                : new Date(String(rawScheduledAtUtc));
                            if (isNaN(scheduledAtUtc.getTime()))
                              return INVALID_DATE;
                            const zoned = fromDate(scheduledAtUtc, "UTC");
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
                                hour12: userTimeFormat === "12h",
                              },
                              userTimeFormat,
                              dateLocale
                            );
                          } catch {
                            return INVALID_DATE;
                          }
                        })()}
                      </td>
                      <td className="p-3 text-center">
                        <div
                          className={`inline-flex rounded-full border border-transparent px-2 py-1 text-xs leading-4 font-semibold ${
                            post.signedEvent
                              ? "bg-muted text-foreground dark:border-border/75 dark:bg-primary/90/10 dark:text-foreground"
                              : "bg-emerald-100 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-700/10 dark:text-emerald-200"
                          }`}
                        >
                          {post.signedEvent ? "Signed" : "Scheduled"}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedPost(post as unknown as PostData)
                          }
                          className="bg-card border-border text-foreground hover:border-border hover:text-foreground focus:ring-ring/25 active:border-border inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-1 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="text-muted-foreground p-4 text-center"
                  >
                    No scheduled posts found
                  </td>
                </tr>
              )}
            </tbody>
            {/* END Table Body */}
          </table>
          {/* END Table */}
        </div>
        {/* END Responsive Table Container */}

        {/* Post Details Modal */}
        {selectedPost ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Post Details</h3>
                <button
                  onClick={() => setSelectedPost(null)}
                  className="hover:bg-muted dark:hover:bg-muted rounded-lg p-1"
                  aria-label="Close"
                >
                  <X
                    className="size-5"
                    strokeWidth={INLINE_ICON_STROKE}
                    aria-hidden
                  />
                </button>
              </div>

              <div className="mb-4">
                {(() => {
                  let modalImage: string | undefined;
                  if (selectedPost.fileUrl.length > 0) {
                    try {
                      const firstFileUrl = selectedPost.fileUrl[0];
                      if (!firstFileUrl) return;
                      const parsed = JSON.parse(firstFileUrl) as string[];
                      modalImage = parsed[0];
                    } catch (_error) {
                      modalImage = selectedPost.fileUrl[0];
                    }
                  }
                  return modalImage ? (
                    <img
                      src={modalImage}
                      alt={selectedPost.caption ?? "Post media"}
                      className="mx-auto max-h-96 rounded-lg object-contain"
                    />
                  ) : (
                    <div className="dark:bg-muted bg-muted mx-auto flex h-48 w-full max-w-md items-center justify-center rounded-lg">
                      <span className="dark:text-muted-foreground text-muted-foreground">
                        Text post
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-3">
                <div>
                  <span className="font-semibold">Caption:</span>
                  <p className="mt-1">{selectedPost.caption ?? "No caption"}</p>
                </div>
                <div>
                  <span className="font-semibold">Type:</span>
                  <p className="mt-1">{selectedPost.postType}</p>
                </div>
                <div>
                  <span className="font-semibold">Scheduled For:</span>
                  <p className="mt-1">
                    {(() => {
                      try {
                        if (!selectedPost.scheduledAtUtc) return INVALID_DATE;
                        const rawScheduledAtUtc =
                          selectedPost.scheduledAtUtc as unknown;
                        const scheduledAtUtc =
                          rawScheduledAtUtc instanceof Date
                            ? rawScheduledAtUtc
                            : new Date(String(rawScheduledAtUtc));
                        if (isNaN(scheduledAtUtc.getTime()))
                          return INVALID_DATE;
                        const zoned = fromDate(scheduledAtUtc, "UTC");
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
                            hour12: userTimeFormat === "12h",
                          },
                          userTimeFormat,
                          dateLocale
                        );
                      } catch {
                        return INVALID_DATE;
                      }
                    })()}
                  </p>
                </div>
                <div>
                  <span className="font-semibold">Status:</span>
                  <div className="mt-1">
                    <span
                      className={`inline-flex rounded-full border border-transparent px-2 py-1 text-xs leading-4 font-semibold ${
                        selectedPost.signedEvent
                          ? "bg-muted text-foreground dark:border-border/75 dark:bg-primary/90/10 dark:text-foreground"
                          : "bg-emerald-100 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-700/10 dark:text-emerald-200"
                      }`}
                    >
                      {selectedPost.signedEvent ? "Signed" : "Scheduled"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* END Tables: With Heading and Search */}
      </div>
    </>
  );
}
