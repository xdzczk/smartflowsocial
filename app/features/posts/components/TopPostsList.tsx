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
    <Card className="flex min-w-0 flex-1 flex-col">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-1.5 px-4 pt-3 pb-1">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Top Posts
        </h3>
        <nav className="flex gap-1 text-xs" aria-label="Top posts timeframe">
          <Link
            to={linkParams(7)}
            className={
              timeframeDays === 7
                ? "text-foreground font-medium underline"
                : "text-muted-foreground/80 hover:text-muted-foreground"
            }
          >
            7d
          </Link>
          <span className="text-muted-foreground/60" aria-hidden>
            |
          </span>
          <Link
            to={linkParams(30)}
            className={
              timeframeDays === 30
                ? "text-foreground font-medium underline"
                : "text-muted-foreground/80 hover:text-muted-foreground"
            }
          >
            30d
          </Link>
        </nav>
      </CardHeader>
      <CardContent className="px-4 pt-0 pb-4">
        {topPosts.length === 0 ? (
          <p className="text-muted-foreground/80 text-xs">
            No posted content in this period.
          </p>
        ) : (
          <ul
            className="flex flex-col gap-1"
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
                    className="border-border/60 hover:bg-muted/40 w-full rounded border p-1.5 text-left text-xs transition-colors"
                  >
                    <p className="text-muted-foreground min-w-0 truncate font-medium">
                      {preview}
                    </p>
                    <p className="text-muted-foreground/80 mt-0.5 text-[11px]">
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
