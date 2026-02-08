import { ImagePlus } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
interface LongFormCoverImageProps {
  image: string;
  uploadError: string;
  uploadProvider: string | null;
  uploadFetcherState: "idle" | "submitting" | "loading";
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  onOpenAssetBrowser: () => void;
  /** When true, label is "Cover image" without asterisk (Article details). */
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
      <div className="mb-2 flex items-center justify-between">
        <Label htmlFor="cover-image-input">
          {softLabel ? "Cover image" : "Cover Image *"}
        </Label>
        {uploadProvider ? (
          <div className="text-muted-foreground flex items-center gap-1 text-xs">
            <span>Upload via:</span>
            <span
              className={`rounded px-2 py-1 text-xs font-medium ${
                uploadProvider.includes("BLOSSOM")
                  ? "bg-muted text-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {uploadProvider.includes("BLOSSOM")
                ? `🌸 ${uploadProvider === "BLOSSOM_PRIMAL" ? "Primal" : "Blosstr"}`
                : "☁️ S3"}
            </span>
          </div>
        ) : null}
      </div>

      {uploadError ? (
        <div className="border-destructive bg-destructive/10 text-destructive mt-1 rounded border p-2 text-sm">
          {uploadError}
        </div>
      ) : null}

      {!image ? (
        <div className="border-border hover:border-border dark:border-border dark:hover:border-border relative mt-1 rounded-lg border-2 border-dashed p-6 text-center transition-colors">
          {uploadFetcherState !== "idle" ? (
            <div className="flex items-center justify-center gap-2">
              <div className="border-primary h-6 w-6 animate-spin rounded-full border-b-2"></div>
              <p className="text-muted-foreground dark:text-foreground text-sm">
                Uploading...
              </p>
            </div>
          ) : (
            <>
              {/* Main upload area - clickable */}
              <div
                className="relative cursor-pointer"
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
                <div className="flex flex-col items-center justify-center gap-4">
                  <ImagePlus
                    className="text-foreground dark:text-muted-foreground h-12 w-12"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <div className="text-center">
                    <p className="text-foreground dark:text-foreground mb-1 text-sm font-medium">
                      Click to upload cover image
                    </p>
                    <p className="text-foreground dark:text-muted-foreground text-xs">
                      PNG, JPG, GIF up to 5MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Separator and Assets button - not clickable for file upload */}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-foreground text-xs">or</span>
                <Button
                  type="button"
                  variant="outline"
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

              {/* Hidden file input */}
              <input
                id="cover-image-input"
                type="file"
                accept="image/*"
                onChange={onImageUpload}
                className="hidden"
                disabled={false}
              />
            </>
          )}
        </div>
      ) : (
        <div className="mt-1">
          {/* Cover Image Preview */}
          <div className="dark:bg-card bg-muted relative overflow-hidden rounded-lg">
            <img
              src={image}
              alt="Cover preview"
              className="h-48 w-full object-cover"
            />
            <div className="bg-opacity-0 hover:bg-opacity-20 absolute inset-0 flex items-center justify-center bg-black opacity-0 transition-all duration-200 hover:opacity-100">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={uploadFetcherState !== "idle"}
                  className="text-foreground relative bg-white/90 hover:bg-white"
                >
                  Replace
                  <input
                    id="cover-image-replace-input"
                    name="cover-image-replace"
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
                  className="bg-primary/90 text-primary-foreground hover:bg-primary"
                >
                  Assets
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={onRemove}
                  disabled={uploadFetcherState !== "idle"}
                  className="bg-destructive/90 hover:bg-destructive text-white"
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
          <p className="text-muted-foreground dark:text-foreground mt-2 text-center text-xs">
            Cover image • Hover to replace or remove
          </p>
        </div>
      )}

      <input type="hidden" name="image" value={image} />
    </div>
  );
}
