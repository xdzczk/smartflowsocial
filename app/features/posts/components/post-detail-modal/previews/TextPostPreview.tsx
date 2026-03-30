import type { PostDetailModalPost } from "../post-detail-helpers";
import {
  getPrimaryNoteText,
  getSecondaryCaption,
} from "../post-detail-helpers";

export function TextPostPreview({
  post,
  contextLine,
  compact,
  bodyEmphasis = "default",
}: {
  post: PostDetailModalPost;
  contextLine: string;
  compact: boolean;
  bodyEmphasis?: "default" | "strong";
}) {
  const primary = getPrimaryNoteText(post);
  const secondary = getSecondaryCaption(post, primary);
  const pad = compact ? "py-1" : "py-2";
  const primaryClass =
    bodyEmphasis === "strong"
      ? "text-foreground text-[15px] font-medium leading-relaxed whitespace-pre-wrap"
      : "text-foreground text-[15px] leading-relaxed whitespace-pre-wrap";

  return (
    <div className={pad}>
      {primary ? (
        <p className={primaryClass}>{primary}</p>
      ) : (
        <p className="text-muted-foreground text-sm italic">Empty post</p>
      )}
      {secondary ? (
        <p className="text-muted-foreground border-border mt-3 border-t pt-3 text-sm leading-relaxed whitespace-pre-wrap">
          {secondary}
        </p>
      ) : null}
      {contextLine ? (
        <p className="text-muted-foreground/70 mt-2 text-[11px] leading-snug">
          {contextLine}
        </p>
      ) : null}
    </div>
  );
}
