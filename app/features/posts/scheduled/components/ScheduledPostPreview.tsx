import type { CalendarPost } from "~/features/posts/calendar";
import { getFirstMediaFromFileUrl } from "~/features/posts/calendar";
import type { LongFormPostData, PostData } from "~/features/posts/types";
import { cn } from "~/lib/utils";

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
  imageClassName,
  captionClassName,
}: {
  post: PostData | LongFormPostData;
  isLongform: boolean;
  className?: string;
  imageClassName?: string;
  captionClassName?: string;
}) {
  const previewImage = getPreviewImage(post, isLongform);
  return (
    <div className={className}>
      {previewImage ? (
        <div
          className={cn(
            "mb-2 max-h-48 w-full overflow-hidden rounded-md",
            imageClassName
          )}
        >
          <img
            src={previewImage}
            alt=""
            className="h-full max-h-48 w-full object-contain"
            loading="lazy"
          />
        </div>
      ) : null}
      <div className={cn("text-foreground text-sm", captionClassName)}>
        {isLongform && "title" in post
          ? (post.title ?? "Untitled article")
          : "caption" in post
            ? post.caption?.trim()
              ? post.caption
              : null
            : null}
        {(!("caption" in post) || !post.caption?.trim()) && !isLongform ? (
          <span className="text-muted-foreground">No caption</span>
        ) : null}
        {"fileUrl" in post && post.fileUrl.length > 0 ? (
          <span className="text-muted-foreground ml-2 text-xs">
            ({post.fileUrl.length} file{post.fileUrl.length > 1 ? "s" : ""})
          </span>
        ) : null}
      </div>
    </div>
  );
}
