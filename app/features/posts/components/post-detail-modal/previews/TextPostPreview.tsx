import { useState } from "react";

import type { PostDetailRelationshipType } from "../derive-post-detail-semantics";
import type { PostDetailModalPost } from "../post-detail-helpers";
import {
  getPrimaryNoteText,
  getSecondaryCaption,
} from "../post-detail-helpers";
import { QuotedPostBlock } from "../relationships/RelationshipPreviewBlocks";

import { PostPreviewSurface } from "./PostPreviewSurface";

// eslint-disable-next-line sonarjs/cognitive-complexity -- relationship-specific branches (quote/repost/reply)
export function TextPostPreview({
  post,
  contextLine,
  compact,
  ultraCompact,
  bodyEmphasis = "default",
  relationshipType = "original",
  detailType,
  replyParentHint,
  quotedSnippet,
  quotedAuthorHint,
  quotedOpenUrl,
  repostSourcePreview,
}: {
  post: PostDetailModalPost;
  contextLine: string;
  compact: boolean;
  ultraCompact?: boolean;
  bodyEmphasis?: "default" | "strong";
  relationshipType?: PostDetailRelationshipType;
  /** When scheduled, empty body shows “No caption” instead of “Empty post”. */
  detailType?: "draft" | "published" | "scheduled";
  replyParentHint?: string | null;
  quotedSnippet?: string | null;
  quotedAuthorHint?: string | null;
  quotedOpenUrl?: string | null;
  repostSourcePreview?: {
    authorLine: string | null;
    snippet: string | null;
    openUrl: string | null;
  } | null;
}) {
  const primary = getPrimaryNoteText(post);
  const secondary = getSecondaryCaption(post, primary);
  const pad = ultraCompact ? "py-0.5" : compact ? "py-1" : "py-2";
  const primaryClass =
    bodyEmphasis === "strong"
      ? "text-text text-[15px] font-medium leading-relaxed whitespace-pre-wrap"
      : "text-text text-[15px] leading-relaxed whitespace-pre-wrap";

  const isRepost = relationshipType === "repost";
  const isQuote = relationshipType === "quote";
  const isReply = relationshipType === "reply";

  const showEmptyBody = !primary && relationshipType === "original";
  const [expanded, setExpanded] = useState(false);
  const shouldClampPrimary = primary.length > 720;
  const primaryBodyClass =
    shouldClampPrimary && !expanded ? "line-clamp-10" : "";

  const repostHero = isRepost && repostSourcePreview?.openUrl;

  return (
    <div className="space-y-3">
      <PostPreviewSurface className={pad}>
        {isReply && replyParentHint ? (
          <p className="text-text-secondary mb-2 text-[11px] font-medium">
            Replying to {replyParentHint}
          </p>
        ) : null}

        {isQuote && primary ? (
          <p className={primaryClass + " " + primaryBodyClass}>{primary}</p>
        ) : null}

        {isQuote ? (
          <div className="mt-3">
            <p className="text-text-secondary/90 mb-1.5 text-[10px] font-medium tracking-tight">
              Quoted post
            </p>
            <QuotedPostBlock
              authorLine={quotedAuthorHint ?? null}
              snippet={quotedSnippet ?? null}
              openUrl={quotedOpenUrl ?? null}
              hasMediaHint={false}
            />
          </div>
        ) : null}

        {isRepost ? (
          <div className="space-y-3">
            {repostHero ? (
              <>
                <div>
                  <p className="text-text-secondary/90 mb-1.5 text-[10px] font-medium tracking-tight">
                    Reposted post
                  </p>
                  <QuotedPostBlock
                    authorLine={repostSourcePreview.authorLine}
                    snippet={repostSourcePreview.snippet}
                    openUrl={repostSourcePreview.openUrl}
                    hasMediaHint={false}
                  />
                </div>
                {primary ? (
                  <div>
                    <p className="text-text-secondary/90 mb-1 text-[10px] font-medium">
                      Added text
                    </p>
                    <p className={primaryClass + " " + primaryBodyClass}>
                      {primary}
                    </p>
                  </div>
                ) : (
                  <p className="text-text-secondary text-sm italic">
                    No added text
                  </p>
                )}
              </>
            ) : primary ? (
              <p className={primaryClass + " " + primaryBodyClass}>{primary}</p>
            ) : (
              <p className="text-text-secondary text-sm italic">Repost</p>
            )}
          </div>
        ) : null}

        {!isQuote && !isRepost ? (
          primary ? (
            <p className={primaryClass + " " + primaryBodyClass}>{primary}</p>
          ) : showEmptyBody ? (
            <p className="text-text-secondary text-sm italic">
              {detailType === "scheduled" ? "No caption" : "Empty post"}
            </p>
          ) : null
        ) : null}

        {shouldClampPrimary ? (
          <button
            type="button"
            className="text-brand mt-1 text-xs font-medium hover:underline"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        ) : null}

        {secondary && !isRepost ? (
          <p className="text-text-secondary border-border mt-3 border-t pt-3 text-sm leading-relaxed whitespace-pre-wrap">
            {secondary}
          </p>
        ) : null}
      </PostPreviewSurface>
      {contextLine ? (
        <p
          className={
            ultraCompact
              ? "text-text-secondary/70 mt-1.5 text-[10px] leading-snug"
              : "text-text-secondary/80 mt-2 text-xs leading-snug"
          }
        >
          {contextLine}
        </p>
      ) : null}
    </div>
  );
}
