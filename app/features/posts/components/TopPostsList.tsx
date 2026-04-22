import { Link, useSearchParams } from "@remix-run/react";
import { Zap, MessageCircle, Heart } from "lucide-react";
import { useState } from "react";

import { Card, CardContent, CardHeader } from "~/components/ui/card";
import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { isVideoFile } from "~/lib/helpers";

import type { PostDTO } from "../dtos";
import { deserializePostDTO } from "../dtos.client";
import type { PostStats } from "../stats.server";
import { getImageUrls } from "../utils/content-helpers";

import PostDetailsModal from "./PostDetailsModal";

export interface TopPostItemDTO {
  post: PostDTO;
  stats: PostStats;
}

export interface TopPostsListProps {
  topPosts: TopPostItemDTO[];
  timeframeDays: number;
  userTimezone?: string;
}

const MINUTES_DAY = 24 * 60;
const MINUTES_MONTH = 30 * MINUTES_DAY;
const MINUTES_YEAR = 365 * MINUTES_DAY;

function getFirstImageUrlFromPost(post: PostDTO): string | null {
  const urls = getImageUrls(post.fileUrl);
  return urls[0] ?? null;
}

function getPreview(post: PostDTO): string {
  const caption = post.caption;
  if (caption && typeof caption === "string" && caption.trim()) {
    return caption.length > 50 ? caption.slice(0, 50) + "…" : caption;
  }
  const content = post.content;
  if (content && typeof content === "string" && content.trim()) {
    return content.length > 50 ? content.slice(0, 50) + "…" : content;
  }
  const postType = post.postType;
  const fileUrl = post.fileUrl;
  const hasMedia = Array.isArray(fileUrl) && fileUrl.length > 0;
  if (postType === "VIDEO") return "Video post";
  if (postType === "CAROUSEL") return "Carousel";
  if (hasMedia) return "Image post";
  if (postType === "POLL") return "Poll";
  if (postType === "TEXT") return "Text post";
  return "Post";
}

function getRelativeTimeAgo(publishedAt: string | null): string {
  if (!publishedAt) return "";
  const then = new Date(publishedAt).getTime();
  const now = Date.now();
  const minutesAgo = (now - then) / 60000;
  if (minutesAgo < 1) return "just now";
  if (minutesAgo < 60) return `${Math.round(minutesAgo)} min ago`;
  if (minutesAgo < 120) return "1 hour ago";
  if (minutesAgo < MINUTES_DAY)
    return `${Math.round(minutesAgo / 60)} hours ago`;
  if (minutesAgo < MINUTES_MONTH) {
    const days = Math.round(minutesAgo / MINUTES_DAY);
    return days === 1 ? "1 day ago" : `${days} days ago`;
  }
  if (minutesAgo < MINUTES_YEAR) {
    const months = Math.round(minutesAgo / MINUTES_MONTH);
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }
  const years = Math.round(minutesAgo / MINUTES_YEAR);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

export default function TopPostsList({
  topPosts,
  timeframeDays,
  userTimezone,
}: TopPostsListProps) {
  const [searchParams] = useSearchParams();
  const [selectedItem, setSelectedItem] = useState<TopPostItemDTO | null>(null);

  const linkParams = (days: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("topPostsDays", String(days));
    return `?${next.toString()}`;
  };

  return (
    <Card className="bg-surface-hover/30 shadow-1 flex min-w-0 flex-1 flex-col dark:shadow-none">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-1.5 px-4 pt-2 pb-1.5">
        <h3 className="text-text text-[11px] font-medium tracking-tight uppercase">
          Top Posts
        </h3>
        <nav className="flex gap-1 text-xs" aria-label="Top posts timeframe">
          <Link
            to={linkParams(7)}
            title="Last 7 days"
            aria-label="Last 7 days"
            className={
              timeframeDays === 7
                ? "text-text focus-visible:ring-focus-ring rounded-xs font-medium underline focus-visible:ring-2 focus-visible:outline-none"
                : "text-text-secondary/80 hover:text-text-secondary focus-visible:ring-focus-ring rounded-xs focus-visible:ring-2 focus-visible:outline-none"
            }
          >
            7d
          </Link>
          <span className="text-text-secondary/60" aria-hidden>
            |
          </span>
          <Link
            to={linkParams(30)}
            title="Last 30 days"
            aria-label="Last 30 days"
            className={
              timeframeDays === 30
                ? "text-text focus-visible:ring-focus-ring rounded-xs font-medium underline focus-visible:ring-2 focus-visible:outline-none"
                : "text-text-secondary/80 hover:text-text-secondary focus-visible:ring-focus-ring rounded-xs focus-visible:ring-2 focus-visible:outline-none"
            }
          >
            30d
          </Link>
        </nav>
      </CardHeader>
      <CardContent className="px-4 pt-0 pb-3">
        {topPosts.length === 0 ? (
          <div className="space-y-1">
            <p className="text-text-secondary/80 text-[11px]">
              No posted content in this period.
            </p>
            <p className="text-text-secondary/60 text-[10px]">
              Posted content in the last {timeframeDays}d will appear here by
              engagement.
            </p>
          </div>
        ) : (
          <ul
            className="flex flex-col gap-0.5"
            aria-label="Top posts by engagement"
          >
            {topPosts.map((item) => {
              const preview = getPreview(item.post);
              const firstImage = getFirstImageUrlFromPost(item.post);
              const relativeTime = getRelativeTimeAgo(item.post.publishedAt);
              const { likes, replies, zaps } = item.stats;
              return (
                <li key={item.post.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className="border-border/60 hover:bg-surface-hover/50 focus-visible:ring-focus-ring flex w-full flex-row items-center gap-3 rounded-xs border p-2 text-left text-[11px] transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    aria-label={`${preview}, Likes ${likes}, Replies ${replies}, Zaps ${zaps}`}
                  >
                    <div className="bg-surface-hover/50 flex h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
                      {firstImage ? (
                        <MediaThumbnail
                          src={firstImage}
                          alt=""
                          className="h-full w-full object-cover"
                          forceType={
                            isVideoFile(firstImage) ? "video" : "image"
                          }
                          hidePlayButton={true}
                          fallback={
                            <div className="bg-surface-hover text-text-secondary flex h-full w-full items-center justify-center text-[10px]">
                              {item.post.postType === "VIDEO"
                                ? "Video"
                                : "Image"}
                            </div>
                          }
                        />
                      ) : (
                        <div className="bg-surface-hover text-text-secondary flex h-full w-full items-center justify-center text-[10px]">
                          {item.post.postType === "TEXT" ? "Text" : "Post"}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-text-secondary/90 min-w-0 truncate text-[11px] leading-snug font-medium">
                        {preview}
                      </p>
                      <p
                        className="text-text-secondary/80 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[11px] leading-snug"
                        aria-hidden
                      >
                        <span className="inline-flex items-center gap-0.5">
                          <Heart className="text-text-secondary/80 size-3.5 shrink-0" />
                          {likes}
                        </span>
                        <span className="text-text-secondary/60" aria-hidden>
                          ·
                        </span>
                        <span className="inline-flex items-center gap-0.5">
                          <MessageCircle className="text-text-secondary/80 size-3.5 shrink-0" />
                          {replies}
                        </span>
                        <span className="text-text-secondary/60" aria-hidden>
                          ·
                        </span>
                        <span className="inline-flex items-center gap-0.5">
                          <Zap className="text-text-secondary/80 size-3.5 shrink-0" />
                          {zaps}
                        </span>
                        {relativeTime ? (
                          <>
                            <span
                              className="text-text-secondary/60"
                              aria-hidden
                            >
                              ·
                            </span>
                            <span>{relativeTime}</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {selectedItem ? (
        <PostDetailsModal
          post={deserializePostDTO(selectedItem.post)}
          stats={selectedItem.stats}
          onClose={() => setSelectedItem(null)}
          showStats={true}
          showSignedEvent={true}
          type="published"
          userTimezone={userTimezone}
        />
      ) : null}
    </Card>
  );
}
