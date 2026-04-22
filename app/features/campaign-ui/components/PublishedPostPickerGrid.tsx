import { useMemo, useState } from "react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { getImageUrls, isVideoFile } from "~/lib/helpers";

export const PUBLISHED_POST_PICKER_PAGE_SIZE = 4;

export interface PublishedPostPickerItem {
  id: string;
  caption: string | null;
  publishedAt: string;
  fileUrl: string[];
  postType: string;
}

function mediaFallbackLabel(postType: string): string {
  switch (postType) {
    case "VIDEO":
      return "VIDEO";
    case "TEXT":
      return "TEXT";
    case "POLL":
      return "POLL";
    case "CAROUSEL":
      return "CAROUSEL";
    default:
      return "IMAGE";
  }
}

export function PublishedPostPickerGrid({
  posts,
  value,
  onValueChange,
  searchInputId = "published-post-picker-search",
  emptyPostsMessage,
  emptyFilterMessage,
}: {
  posts: PublishedPostPickerItem[];
  value: string;
  onValueChange: (id: string) => void;
  searchInputId?: string;
  emptyPostsMessage: string;
  emptyFilterMessage: string;
}) {
  const [postSearch, setPostSearch] = useState("");
  const [listPage, setListPage] = useState(1);

  const filteredPosts = useMemo(() => {
    const q = postSearch.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) => {
      const cap = (p.caption ?? "").toLowerCase();
      return cap.includes(q) || p.id.toLowerCase().includes(q);
    });
  }, [postSearch, posts]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredPosts.length / PUBLISHED_POST_PICKER_PAGE_SIZE)
  );
  const safePage = Math.max(1, Math.min(listPage, pageCount));

  const pagedPosts = useMemo(() => {
    const start = (safePage - 1) * PUBLISHED_POST_PICKER_PAGE_SIZE;
    return filteredPosts.slice(start, start + PUBLISHED_POST_PICKER_PAGE_SIZE);
  }, [filteredPosts, safePage]);

  const rangeStart =
    filteredPosts.length === 0
      ? 0
      : (safePage - 1) * PUBLISHED_POST_PICKER_PAGE_SIZE + 1;
  const rangeEnd =
    filteredPosts.length === 0
      ? 0
      : Math.min(
          safePage * PUBLISHED_POST_PICKER_PAGE_SIZE,
          filteredPosts.length
        );

  return (
    <div className="space-y-2">
      <label htmlFor={searchInputId} className="text-text-secondary text-sm">
        Search posts
      </label>
      <input
        id={searchInputId}
        type="search"
        value={postSearch}
        onChange={(e) => {
          setPostSearch(e.target.value);
          setListPage(1);
        }}
        placeholder="Filter by caption…"
        className="border-border bg-canvas mb-2 w-full max-w-md rounded-md border px-3 py-2 text-sm"
      />
      {filteredPosts.length === 0 ? (
        <p className="text-text-secondary text-sm">
          {posts.length === 0 ? emptyPostsMessage : emptyFilterMessage}
        </p>
      ) : (
        <div className="space-y-3">
          <div className="text-text-secondary flex flex-wrap items-center justify-between gap-2 text-xs">
            <span>
              Showing{" "}
              <span className="text-text font-medium tabular-nums">
                {rangeStart}–{rangeEnd}
              </span>{" "}
              of{" "}
              <span className="text-text font-medium tabular-nums">
                {filteredPosts.length}
              </span>
            </span>
            <div className="cluster">
              <button
                type="button"
                className="border-border bg-canvas hover:bg-surface-hover rounded-md border px-2 py-1 text-xs font-medium disabled:pointer-events-none disabled:opacity-40"
                disabled={safePage <= 1}
                onClick={() => {
                  setListPage((p) => Math.max(1, Math.min(p, pageCount) - 1));
                }}
              >
                Previous
              </button>
              <span className="text-text-secondary tabular-nums">
                Page {safePage} of {pageCount}
              </span>
              <button
                type="button"
                className="border-border bg-canvas hover:bg-surface-hover rounded-md border px-2 py-1 text-xs font-medium disabled:pointer-events-none disabled:opacity-40"
                disabled={safePage >= pageCount}
                onClick={() => {
                  setListPage((p) => {
                    const cur = Math.max(1, Math.min(p, pageCount));
                    return Math.min(pageCount, cur + 1);
                  });
                }}
              >
                Next
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {pagedPosts.map((p) => {
              const selected = p.id === value;
              const urls = getImageUrls(p.fileUrl);
              const firstUrl = urls[0];
              const badge = mediaFallbackLabel(p.postType);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    onValueChange(p.id);
                  }}
                  className={`border-border bg-canvas motion-fast flex flex-col overflow-hidden rounded-lg border text-left ${selected ? "bg-surface-selected border-brand ring-brand/20 ring-2" : "hover:border-brand/40"}`}
                >
                  <div className="bg-surface-hover relative aspect-video w-full overflow-hidden">
                    {firstUrl ? (
                      <MediaThumbnail
                        src={firstUrl}
                        alt="Post preview"
                        className="h-full w-full object-cover"
                        forceType={isVideoFile(firstUrl) ? "video" : undefined}
                        hidePlayButton={false}
                        fallback={
                          <div className="text-text-secondary flex h-full w-full items-center justify-center text-xs font-medium">
                            {badge}
                          </div>
                        }
                      />
                    ) : (
                      <div className="text-text-secondary flex h-full w-full items-center justify-center text-xs font-medium">
                        {badge}
                      </div>
                    )}
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col gap-1 p-3">
                    <p
                      className={`line-clamp-3 text-sm leading-snug ${p.caption?.trim() ? "text-text font-medium" : "text-text-secondary italic"}`}
                    >
                      {p.caption?.trim() ? p.caption.trim() : "No caption"}
                    </p>
                    <p className="text-text-secondary mt-auto text-xs">
                      {new Date(p.publishedAt).toLocaleString()}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
