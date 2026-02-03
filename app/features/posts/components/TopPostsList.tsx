import { Link, useSearchParams } from "@remix-run/react";
import { useState } from "react";

import { Card, CardContent, CardHeader } from "~/components/ui/card";

import type { PostDTO } from "../dtos";
import { deserializePostDTO } from "../dtos.client";
import type { PostStats } from "../stats.server";

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

function getPreview(post: PostDTO): string {
  const caption = post.caption;
  if (caption && typeof caption === "string") {
    return caption.length > 50 ? caption.slice(0, 50) + "…" : caption;
  }
  return "Post";
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
    <Card className="bg-muted/30 flex min-w-0 flex-1 flex-col shadow-sm dark:shadow-none">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-1.5 px-4 pt-2 pb-0.5">
        <h3 className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          Top Posts
        </h3>
        <nav className="flex gap-1 text-xs" aria-label="Top posts timeframe">
          <Link
            to={linkParams(7)}
            title="Last 7 days"
            aria-label="Last 7 days"
            className={
              timeframeDays === 7
                ? "text-foreground focus:ring-primary rounded font-medium underline focus:ring-2 focus:ring-offset-2 focus:outline-none"
                : "text-muted-foreground/80 hover:text-muted-foreground focus:ring-primary rounded focus:ring-2 focus:ring-offset-2 focus:outline-none"
            }
          >
            7d
          </Link>
          <span className="text-muted-foreground/60" aria-hidden>
            |
          </span>
          <Link
            to={linkParams(30)}
            title="Last 30 days"
            aria-label="Last 30 days"
            className={
              timeframeDays === 30
                ? "text-foreground focus:ring-primary rounded font-medium underline focus:ring-2 focus:ring-offset-2 focus:outline-none"
                : "text-muted-foreground/80 hover:text-muted-foreground focus:ring-primary rounded focus:ring-2 focus:ring-offset-2 focus:outline-none"
            }
          >
            30d
          </Link>
        </nav>
      </CardHeader>
      <CardContent className="px-4 pt-0 pb-3">
        {topPosts.length === 0 ? (
          <p className="text-muted-foreground/80 text-[11px]">
            No posted content in this period.
          </p>
        ) : (
          <ul
            className="flex flex-col gap-0.5"
            aria-label="Top posts by engagement"
          >
            {topPosts.map((item) => {
              const preview = getPreview(item.post);
              const { likes, replies, zaps } = item.stats;
              return (
                <li key={item.post.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className="border-border/60 hover:bg-muted/40 focus:ring-primary w-full rounded border p-1 text-left text-[11px] transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
                    aria-label={`${preview}, Likes ${likes}, Replies ${replies}, Zaps ${zaps}`}
                  >
                    <p className="text-muted-foreground min-w-0 truncate text-[11px] font-medium">
                      {preview}
                    </p>
                    <p
                      className="text-muted-foreground/80 mt-0.5 text-[10px]"
                      aria-hidden
                    >
                      ♥ {likes} · 💬 {replies} · ⚡ {zaps}
                    </p>
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
          type="posted"
          userTimezone={userTimezone}
        />
      ) : null}
    </Card>
  );
}
