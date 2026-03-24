import { contestCopy } from "../contest-copy";

export function ContestSourcePostCard({
  caption,
  fileUrl,
  publishedAt,
  nostrEventId,
  onOpenNostr,
}: {
  caption: string | null;
  fileUrl: string[];
  publishedAt: string | null;
  nostrEventId: string | null;
  onOpenNostr?: () => void;
}) {
  const thumb = fileUrl[0];
  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border">
      <div className="border-border border-b px-4 py-2">
        <h3 className="text-sm font-semibold">{contestCopy.sourcePost}</h3>
      </div>
      <div className="flex flex-col gap-3 p-4 sm:flex-row">
        {thumb ? (
          <div className="bg-muted shrink-0 overflow-hidden rounded-md sm:h-24 sm:w-32">
            {thumb.match(/\.(mp4|webm)$/i) ? (
              <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
                Video
              </div>
            ) : (
              <img
                src={thumb}
                alt=""
                className="h-full max-h-32 w-full object-cover"
              />
            )}
          </div>
        ) : null}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm whitespace-pre-wrap">
            {caption?.trim() ? caption.trim() : "(No caption)"}
          </p>
          <p className="text-muted-foreground text-xs">
            {publishedAt
              ? new Date(publishedAt).toLocaleString()
              : "Not published"}
            {nostrEventId ? (
              <>
                {" · "}
                <span className="font-mono">{nostrEventId.slice(0, 12)}…</span>
              </>
            ) : null}
          </p>
          {onOpenNostr && nostrEventId ? (
            <button
              type="button"
              onClick={onOpenNostr}
              className="text-primary text-sm font-medium hover:underline"
            >
              {contestCopy.openSourcePost}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
