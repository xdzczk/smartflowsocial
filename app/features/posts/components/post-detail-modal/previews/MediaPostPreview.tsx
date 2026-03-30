import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { getImageUrls } from "~/lib/helpers";
import { cn } from "~/lib/utils";

import type { PostDetailModalPost } from "../post-detail-helpers";

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
    <div className="space-y-4 py-1">
      {singleImageUrl ? (
        <button
          type="button"
          className="bg-muted/20 ring-border/60 relative block max-h-[min(52vh,520px)] w-full overflow-hidden rounded-xl ring-1"
          onClick={() => onImageClick(singleImageUrl)}
        >
          <MediaThumbnail
            src={singleImageUrl}
            alt="Post media"
            className="max-h-[min(52vh,520px)] w-full object-contain"
          />
        </button>
      ) : (
        <div
          className={cn(
            "ring-border/60 grid gap-2 overflow-hidden rounded-xl ring-1",
            n === 2 && "grid-cols-2",
            n >= 3 && "grid-cols-2"
          )}
        >
          {urls.map((url, index) => (
            <button
              key={url}
              type="button"
              className={cn(
                "bg-muted/25 relative aspect-square overflow-hidden",
                n === 3 && index === 0 && "col-span-2 aspect-video max-h-56"
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
      <div>
        {caption ? (
          <p className="text-foreground text-[15px] leading-relaxed whitespace-pre-wrap">
            {caption}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm italic">No caption</p>
        )}
        <p className="text-muted-foreground mt-2 text-xs">{contextLine}</p>
      </div>
    </div>
  );
}
