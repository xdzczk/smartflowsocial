/**
 * Content editor component for LongFormPost
 * Tiptap editor with markdown sync; client-only mount to avoid SSR.
 */

import { EditorContent } from "@tiptap/react";
import { FolderOpen } from "lucide-react";
import type React from "react";

import { Button } from "~/components/ui/button";
import { TiptapToolbar } from "~/features/posts/components/TiptapToolbar";
import {
  SMALL_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";

interface LongFormContentEditorProps {
  uploadProvider?: string | null;
  onOpenAssetBrowser: () => void;
  /** When false, hide the "Content *" label (for writing-surface hero). Default true. */
  showLabel?: boolean;
  /** When false, block pointer events on editor area until editor is ready. */
  editorReady?: boolean;
  /** Tiptap editor instance (null before client mount). */
  editor: React.ComponentProps<typeof EditorContent>["editor"];
}

const EDITOR_MIN_HEIGHT = "min-h-[500px]";
const PLACEHOLDER_MIN_HEIGHT = "min-h-[500px]";

export function LongFormContentEditor({
  uploadProvider,
  onOpenAssetBrowser,
  showLabel = true,
  editorReady = true,
  editor,
}: LongFormContentEditorProps) {
  const showPlaceholder = !editor;

  return (
    <div>
      {showLabel ? (
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span
              id="content-label"
              className="text-sm leading-none font-medium"
            >
              Content *
            </span>
            {uploadProvider ? (
              <div className="text-muted-foreground flex items-center gap-1 text-xs">
                <span>Images upload via:</span>
                <span className="bg-muted text-foreground rounded px-2 py-1 text-xs font-medium">
                  {uploadProvider.includes("BLOSSOM")
                    ? `🌸 ${uploadProvider === "BLOSSOM_PRIMAL" ? "Primal" : uploadProvider === "BLOSSOM_SFS" ? "SmartFlow Blossom" : "Blosstr"}`
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
            <FolderOpen
              className={`mr-1 ${SMALL_ICON_SIZE_CLASS}`}
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
            Insert Assets
          </Button>
        </div>
      ) : (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={onOpenAssetBrowser}
            className="text-muted-foreground hover:text-foreground text-xs underline focus:ring-0 focus:outline-none"
          >
            Insert Assets
          </button>
        </div>
      )}
      <div
        className={
          showLabel
            ? "border-border dark:border-border focus-within:border-primary focus-within:ring-ring mt-1 rounded-lg border focus-within:ring-1"
            : "border-border/50 border-b pt-1"
        }
      >
        <div
          className={`${showPlaceholder ? PLACEHOLDER_MIN_HEIGHT : EDITOR_MIN_HEIGHT} p-4 ${!editorReady ? "pointer-events-none select-none" : ""}`}
          aria-busy={!editorReady}
          aria-label={!editorReady ? "Editor loading" : undefined}
        >
          {showPlaceholder ? (
            <div
              className="prose prose-lg dark:prose-invert text-muted-foreground min-h-[460px] max-w-none"
              role="textbox"
              aria-labelledby={showLabel ? "content-label" : undefined}
              aria-label={showLabel ? undefined : "Article content"}
            >
              <p>Loading editor…</p>
            </div>
          ) : (
            <>
              <TiptapToolbar
                editor={editor}
                onInsertImage={onOpenAssetBrowser}
              />
              <EditorContent
                editor={editor}
                className="prose prose-lg dark:prose-invert min-h-[460px] max-w-none [&_.ProseMirror]:min-h-[460px] [&_.ProseMirror]:outline-none"
                aria-labelledby={showLabel ? "content-label" : undefined}
                aria-label={showLabel ? undefined : "Article content"}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
