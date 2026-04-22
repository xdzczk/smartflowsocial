import { Upload } from "lucide-react";

import { Button } from "~/components/ui/button";
import { ComposerCanvasSectionLabel } from "~/features/posts/composer/components/composer";
import { BRAND_BLOSSOM_LABEL } from "~/lib/brand";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

interface LongFormCoverImageProps {
  image: string;
  uploadError: string;
  uploadProvider: string | null;
  uploadFetcherState: "idle" | "submitting" | "loading";
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  onOpenAssetBrowser: () => void;
  /** Softer label (no required asterisk in copy). */
  softLabel?: boolean;
  /** Blossom file upload disabled (no extension / remote signer). */
  coverFileUploadDisabled?: boolean;
}

export function LongFormCoverImage({
  image,
  uploadError,
  uploadProvider,
  uploadFetcherState,
  onImageUpload,
  onRemove,
  onOpenAssetBrowser,
  softLabel = false,
  coverFileUploadDisabled = false,
}: LongFormCoverImageProps) {
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <ComposerCanvasSectionLabel
            as="label"
            className="mb-0"
            htmlFor="cover-image-input"
            tone="article"
          >
            {softLabel ? "Cover" : "Cover *"}
          </ComposerCanvasSectionLabel>
        </div>
        {uploadProvider ? (
          <div className="text-text-secondary/45 flex shrink-0 items-center gap-1 text-[10px]">
            <span>via</span>
            <span className="text-text-secondary/70 rounded-xs px-1 py-px font-medium">
              {uploadProvider.includes("BLOSSOM")
                ? `🌸 ${uploadProvider === "BLOSSOM_PRIMAL" ? "Primal" : uploadProvider === "BLOSSOM_SFS" ? BRAND_BLOSSOM_LABEL : "Blosstr"}`
                : "☁️ S3"}
            </span>
          </div>
        ) : null}
      </div>

      {uploadError ? (
        <div className="border-danger bg-danger/10 text-danger mt-1 rounded-md border p-2 text-sm">
          {uploadError}
        </div>
      ) : null}

      {coverFileUploadDisabled && uploadProvider?.includes("BLOSSOM") ? (
        <div
          className="border-warning/55 bg-warning/10 text-warning-text mt-1 rounded-md border px-2.5 py-2 text-[11px] leading-snug"
          role="note"
        >
          Cover file upload needs a NIP-07 browser extension or connected remote
          signer (NIP-46). Open Settings to connect. You can still use{" "}
          <span className="font-medium">From assets</span> if you have hosted
          images.
        </div>
      ) : null}

      {!image ? (
        <div className="mt-2">
          {uploadFetcherState !== "idle" ? (
            <div className="border-border/15 bg-surface-hover/[0.02] flex min-h-[6.5rem] items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6">
              <div className="border-brand h-5 w-5 animate-spin rounded-full border-2 border-b-transparent" />
              <p className="text-text-secondary/80 text-sm">Uploading…</p>
            </div>
          ) : (
            <div className="border-border/15 bg-surface-hover/[0.015] flex min-h-[6.75rem] flex-col justify-center gap-4 rounded-xl border border-dashed px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <p className="text-text-secondary/85 max-w-sm text-[13px] leading-relaxed">
                Optional hero for feeds and link cards.
              </p>
              <div
                className="border-border/35 bg-canvas/60 flex h-9 shrink-0 overflow-hidden rounded-md border shadow-none"
                role="group"
                aria-label="Cover image source"
              >
                <button
                  type="button"
                  disabled={coverFileUploadDisabled}
                  onClick={() =>
                    document.getElementById("cover-image-input")?.click()
                  }
                  className={cn(
                    "text-text/90 border-border/35 inline-flex items-center border-r px-3 text-xs font-medium transition-colors",
                    "hover:bg-surface-hover/40 disabled:pointer-events-none disabled:opacity-45"
                  )}
                >
                  <Upload
                    className="text-text-secondary mr-1.5 h-3.5 w-3.5"
                    strokeWidth={INLINE_ICON_STROKE}
                    aria-hidden
                  />
                  Upload
                </button>
                <button
                  type="button"
                  onClick={onOpenAssetBrowser}
                  className="text-text-secondary hover:text-text/90 hover:bg-surface-hover/30 px-3 text-xs font-medium transition-colors"
                >
                  From assets
                </button>
              </div>
            </div>
          )}
          <p className="text-text-secondary/45 mt-2 max-w-xl text-[10px] leading-snug">
            ~1200×630 for link previews · PNG, JPG, or GIF up to 5MB
          </p>
          <input
            id="cover-image-input"
            type="file"
            accept="image/*"
            onChange={onImageUpload}
            className="hidden"
            disabled={coverFileUploadDisabled}
          />
        </div>
      ) : (
        <div className="mt-1">
          <div className="border-border/35 relative overflow-hidden rounded-lg border bg-black/5 dark:bg-white/5">
            <div className="aspect-[21/9] max-h-[260px] min-h-[140px] w-full">
              <img
                src={image}
                alt="Article cover preview"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/0 opacity-0 transition-all hover:bg-black/35 hover:opacity-100">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={
                  uploadFetcherState !== "idle" || coverFileUploadDisabled
                }
                className="bg-canvas/90 text-text shadow-1 relative h-8 text-xs backdrop-blur-sm"
              >
                Replace
                <input
                  type="file"
                  accept="image/*"
                  onChange={onImageUpload}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  disabled={
                    uploadFetcherState !== "idle" || coverFileUploadDisabled
                  }
                  aria-label="Replace cover image"
                />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onOpenAssetBrowser}
                disabled={uploadFetcherState !== "idle"}
                className="bg-canvas/85 text-text h-8 text-xs backdrop-blur-sm"
              >
                Assets
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRemove}
                disabled={uploadFetcherState !== "idle"}
                className="text-danger hover:text-danger h-8 text-xs"
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}

      <input type="hidden" name="image" value={image} />
    </div>
  );
}
