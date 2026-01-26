/**
 * Content editor component for LongFormPost
 * Handles the EditorJS instance and asset insertion
 */

import { Button } from "~/components/ui/button";

interface LongFormContentEditorProps {
  uploadProvider?: string | null;
  onOpenAssetBrowser: () => void;
}

export function LongFormContentEditor({
  uploadProvider,
  onOpenAssetBrowser,
}: LongFormContentEditorProps) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span id="content-label" className="text-sm leading-none font-medium">
            Content *
          </span>
          {uploadProvider ? (
            <div className="text-muted-foreground flex items-center gap-1 text-xs">
              <span>Images upload via:</span>
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenAssetBrowser}
          className="text-xs"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mr-1 h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          Insert Assets
        </Button>
      </div>
      <div className="border-border dark:border-border focus-within:border-primary focus-within:ring-primary mt-1 rounded-lg border focus-within:ring-1">
        <div className="min-h-[500px] p-4">
          <div
            id="editorjs"
            className="prose prose-lg dark:prose-invert min-h-[460px] max-w-none"
            role="textbox"
            aria-labelledby="content-label"
          ></div>
        </div>
      </div>
      <input type="hidden" name="content" id="content" />
    </div>
  );
}
