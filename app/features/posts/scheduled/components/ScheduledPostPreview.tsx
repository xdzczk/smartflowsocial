import type { CalendarPost } from "~/features/posts/calendar";
import { getFirstMediaFromFileUrl } from "~/features/posts/calendar";
import type { LongFormPostData, PostData } from "~/features/posts/types";

function getPreviewImage(
  post: PostData | LongFormPostData,
  isLongform: boolean
): string | null {
  if (isLongform && "image" in post && post.image) return post.image;
  if ("fileUrl" in post && post.fileUrl.length) {
    return getFirstMediaFromFileUrl(post as unknown as CalendarPost);
  }
  return null;
}

export function ScheduledPostPreview({
  post,
  isLongform,
  className,
}: {
  post: PostData | LongFormPostData;
  isLongform: boolean;
  className?: string;
}) {
  const previewImage = getPreviewImage(post, isLongform);
  return (
    <div className={className}>
      {previewImage ? (
        <div className="mb-2 max-h-48 w-full overflow-hidden rounded-md">
          <img
            src={previewImage}
            alt=""
            className="h-full max-h-48 w-full object-contain"
            loading="lazy"
          />
        </div>
      ) : null}
      <div className="text-foreground text-sm">
        {isLongform && "title" in post
          ? (post.title ?? "Untitled article")
          : "caption" in post
            ? post.caption?.trim()
              ? post.caption
              : "No caption"
            : "No caption"}
        {"fileUrl" in post && post.fileUrl.length > 0 ? (
          <span className="text-muted-foreground ml-2 text-xs">
            ({post.fileUrl.length} file{post.fileUrl.length > 1 ? "s" : ""})
          </span>
        ) : null}
      </div>
    </div>
  );
}
