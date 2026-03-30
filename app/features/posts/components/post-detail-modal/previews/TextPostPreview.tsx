import type { PostDetailModalPost } from "../post-detail-helpers";
import {
  getPrimaryNoteText,
  getSecondaryCaption,
} from "../post-detail-helpers";

export function TextPostPreview({
  post,
  contextLine,
  compact,
}: {
  post: PostDetailModalPost;
  contextLine: string;
  compact: boolean;
}) {
  const primary = getPrimaryNoteText(post);
  const secondary = getSecondaryCaption(post, primary);
  const pad = compact ? "py-1" : "py-2";

  return (
    <div className={pad}>
      {primary ? (
        <p className="text-foreground text-[15px] leading-relaxed whitespace-pre-wrap">
          {primary}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm italic">Empty post</p>
      )}
      {secondary ? (
        <p className="text-muted-foreground border-border mt-3 border-t pt-3 text-sm leading-relaxed whitespace-pre-wrap">
          {secondary}
        </p>
      ) : null}
      <p className="text-muted-foreground mt-3 text-xs">{contextLine}</p>
    </div>
  );
}
