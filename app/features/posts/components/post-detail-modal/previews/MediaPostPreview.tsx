import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { getImageUrls } from "~/lib/helpers";
import { cn } from "~/lib/utils";

import type { PostDetailModalPost } from "../post-detail-helpers";

import { PostPreviewSurface } from "./PostPreviewSurface";

export function MediaPostPreview({
  post,
  contextLine,
  onImageClick,
}: {
  post: PostDetailModalPost;
  contextLine: string;
  onImageClick: (url: string) => void;
}) {
  const urls = post.fileUrl ? getImageUrls(post.fileUrl) : [];
  const n = urls.length;
  const singleImageUrl = n === 1 ? urls[0] : undefined;
  const caption = post.caption?.trim();

  return (
    <div className="space-y-3">
      <PostPreviewSurface>
        <div className="space-y-4">
          {singleImageUrl ? (
            <button
              type="button"
              className="bg-muted/30 border-border/60 relative mx-auto block max-h-[min(54vh,560px)] w-full overflow-hidden rounded-xl border"
              onClick={() => onImageClick(singleImageUrl)}
            >
              <MediaThumbnail
                src={singleImageUrl}
                alt="Post media"
                className="max-h-[min(54vh,560px)] w-full object-contain"
              />
            </button>
          ) : (
            <div
              className={cn(
                "grid gap-2 overflow-hidden rounded-xl",
                n === 2 && "grid-cols-2",
                n >= 3 && "grid-cols-2"
              )}
            >
              {urls.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  className={cn(
                    "bg-muted/35 border-border/60 relative aspect-square overflow-hidden rounded-lg border",
                    n === 3 &&
                      index === 0 &&
                      "col-span-2 aspect-[16/9] max-h-72"
                  )}
                  onClick={() => onImageClick(url)}
                >
                  <MediaThumbnail
                    src={url}
                    alt={`Post media ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
          {caption ? (
            <p className="text-foreground text-[15px] leading-relaxed whitespace-pre-wrap">
              {caption}
            </p>
          ) : null}
        </div>
      </PostPreviewSurface>
      <div>
        {!caption ? (
          <p className="text-muted-foreground text-sm italic">No caption</p>
        ) : null}
        {contextLine ? (
          <p className="text-muted-foreground/80 mt-1.5 text-xs leading-snug">
            {contextLine}
          </p>
        ) : null}
      </div>
    </div>
  );
}
