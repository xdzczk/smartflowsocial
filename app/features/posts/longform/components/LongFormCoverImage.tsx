import { ImagePlus } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";

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
}: LongFormCoverImageProps) {
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <Label
            htmlFor="cover-image-input"
            className="text-foreground text-sm font-medium"
          >
            {softLabel ? "Cover" : "Cover *"}
          </Label>
          <p className="text-muted-foreground mt-0.5 max-w-xl text-[11px] leading-snug">
            Wide images (~1200×630) work well for previews. PNG, JPG, or GIF up
            to 5MB.
          </p>
        </div>
        {uploadProvider ? (
          <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
            <span>Upload via</span>
            <span className="bg-muted text-foreground rounded px-1.5 py-0.5 font-medium">
              {uploadProvider.includes("BLOSSOM")
                ? `🌸 ${uploadProvider === "BLOSSOM_PRIMAL" ? "Primal" : uploadProvider === "BLOSSOM_SFS" ? "SmartFlow Blossom" : "Blosstr"}`
                : "☁️ S3"}
            </span>
          </div>
        ) : null}
      </div>

      {uploadError ? (
        <div className="border-destructive bg-destructive/10 text-destructive mt-1 rounded-md border p-2 text-sm">
          {uploadError}
        </div>
      ) : null}

      {!image ? (
        <div className="border-border bg-muted/20 hover:bg-muted/30 relative mt-1 overflow-hidden rounded-xl border transition-colors">
          <div className="aspect-[21/9] min-h-[140px] w-full">
            {uploadFetcherState !== "idle" ? (
              <div className="flex h-full items-center justify-center gap-2">
                <div className="border-primary h-6 w-6 animate-spin rounded-full border-b-2" />
                <p className="text-muted-foreground text-sm">Uploading…</p>
              </div>
            ) : (
              <div
                className="flex h-full cursor-pointer flex-col items-center justify-center gap-3 px-4 py-8"
                onClick={() =>
                  document.getElementById("cover-image-input")?.click()
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    document.getElementById("cover-image-input")?.click();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Upload cover image"
              >
                <ImagePlus
                  className="text-muted-foreground h-10 w-10"
                  strokeWidth={INLINE_ICON_STROKE}
                  aria-hidden
                />
                <div className="text-center">
                  <p className="text-foreground text-sm font-medium">
                    Add a cover image
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Click to upload or choose from assets
                  </p>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenAssetBrowser();
                    }}
                    className="text-xs"
                  >
                    Choose from Assets
                  </Button>
                </div>
              </div>
            )}
          </div>
          <input
            id="cover-image-input"
            type="file"
            accept="image/*"
            onChange={onImageUpload}
            className="hidden"
          />
        </div>
      ) : (
        <div className="mt-1">
          <div className="border-border relative overflow-hidden rounded-xl border bg-black/5 dark:bg-white/5">
            <div className="aspect-[21/9] max-h-[280px] min-h-[160px] w-full">
              <img
                src={image}
                alt="Article cover preview"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all hover:bg-black/40 hover:opacity-100">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploadFetcherState !== "idle"}
                className="bg-background/95 text-foreground relative shadow-sm"
              >
                Replace
                <input
                  type="file"
                  accept="image/*"
                  onChange={onImageUpload}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  disabled={uploadFetcherState !== "idle"}
                  aria-label="Replace cover image"
                />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onOpenAssetBrowser}
                disabled={uploadFetcherState !== "idle"}
                className="bg-background/95"
              >
                Assets
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onRemove}
                disabled={uploadFetcherState !== "idle"}
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
