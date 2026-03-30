import type { PostDetailRelationshipType } from "../derive-post-detail-semantics";
import type { PostDetailModalPost } from "../post-detail-helpers";
import {
  getPrimaryNoteText,
  getSecondaryCaption,
} from "../post-detail-helpers";
import { QuotedPostBlock } from "../relationships/RelationshipPreviewBlocks";

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
      ? "text-foreground text-[15px] font-medium leading-relaxed whitespace-pre-wrap"
      : "text-foreground text-[15px] leading-relaxed whitespace-pre-wrap";

  const isRepost = relationshipType === "repost";
  const isQuote = relationshipType === "quote";
  const isReply = relationshipType === "reply";

  const showEmptyBody = !primary && relationshipType === "original";

  const repostHero = isRepost && repostSourcePreview?.openUrl;

  return (
    <div className={pad}>
      {isReply && replyParentHint ? (
        <p className="text-muted-foreground mb-2 text-[11px] font-medium">
          Replying to {replyParentHint}
        </p>
      ) : null}

      {isQuote && primary ? <p className={primaryClass}>{primary}</p> : null}

      {isQuote ? (
        <div className="mt-3">
          <p className="text-muted-foreground/90 mb-1.5 text-[10px] font-medium tracking-tight">
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
                <p className="text-muted-foreground/90 mb-1.5 text-[10px] font-medium tracking-tight">
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
                  <p className="text-muted-foreground/90 mb-1 text-[10px] font-medium">
                    Added text
                  </p>
                  <p className={primaryClass}>{primary}</p>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm italic">
                  No added text
                </p>
              )}
            </>
          ) : primary ? (
            <p className={primaryClass}>{primary}</p>
          ) : (
            <p className="text-muted-foreground text-sm italic">Repost</p>
          )}
        </div>
      ) : null}

      {!isQuote && !isRepost ? (
        primary ? (
          <p className={primaryClass}>{primary}</p>
        ) : showEmptyBody ? (
          <p className="text-muted-foreground text-sm italic">
            {detailType === "scheduled" ? "No caption" : "Empty post"}
          </p>
        ) : null
      ) : null}

      {secondary && !isRepost ? (
        <p className="text-muted-foreground border-border mt-3 border-t pt-3 text-sm leading-relaxed whitespace-pre-wrap">
          {secondary}
        </p>
      ) : null}
      {contextLine ? (
        <p
          className={
            ultraCompact
              ? "text-muted-foreground/70 mt-1.5 text-[10px] leading-snug"
              : "text-muted-foreground/70 mt-2 text-[11px] leading-snug"
          }
        >
          {contextLine}
        </p>
      ) : null}
    </div>
  );
}
