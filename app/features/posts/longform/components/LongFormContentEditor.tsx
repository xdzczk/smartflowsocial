/**
 * Content editor for LongFormPost: Tiptap + markdown sync.
 * `surface="editorial"` — unified chrome for article composer; `legacy` — form / modal layout.
 */

import { EditorContent } from "@tiptap/react";
import { FolderOpen } from "lucide-react";
import type React from "react";

import { Button } from "~/components/ui/button";
import { MarkdownPreview } from "~/features/posts/components/MarkdownPreview";
import { TiptapToolbar } from "~/features/posts/components/TiptapToolbar";
import {
  SMALL_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

interface LongFormContentEditorProps {
  uploadProvider?: string | null;
  onOpenAssetBrowser: () => void;
  /** When false, hide the "Content *" label (legacy hero). Default true. */
  showLabel?: boolean;
  /** `editorial` — article composer chrome; `legacy` — existing form behavior. */
  surface?: "legacy" | "editorial";
  /** When surface is editorial, toggle body view. */
  bodyView?: "edit" | "preview";
  /** Markdown source for preview mode. */
  previewMarkdown?: string;
  /** Leading chrome (e.g. Edit / Preview control). */
  chromeLeading?: React.ReactNode;
  /** Trailing chrome (e.g. Drafts / Templates). */
  chromeTrailing?: React.ReactNode;
  /** When false, block pointer events on editor area until editor is ready. */
  editorReady?: boolean;
  /** Tiptap editor instance (null before client mount). */
  editor: React.ComponentProps<typeof EditorContent>["editor"];
}

const EDITOR_MIN_HEIGHT = "min-h-[min(56vh,29rem)]";
const PLACEHOLDER_MIN_HEIGHT = "min-h-[min(56vh,29rem)]";

function blossomOrS3BadgeLabel(uploadProvider: string): string {
  if (!uploadProvider.includes("BLOSSOM")) return "☁️ S3";
  if (uploadProvider === "BLOSSOM_PRIMAL") return "🌸 Primal";
  if (uploadProvider === "BLOSSOM_SFS") return "🌸 SmartFlow Blossom";
  return "🌸 Blosstr";
}

function EditorialLongFormContentEditor({
  uploadProvider,
  bodyView,
  previewMarkdown,
  chromeLeading,
  chromeTrailing,
  editorReady,
  editor,
}: Pick<
  LongFormContentEditorProps,
  | "uploadProvider"
  | "bodyView"
  | "previewMarkdown"
  | "chromeLeading"
  | "chromeTrailing"
  | "editorReady"
  | "editor"
>) {
  const showPlaceholder = !editor;
  const uploadHint =
    uploadProvider != null ? (
      <div className="text-muted-foreground/80 hidden items-center gap-1 text-[10px] sm:flex">
        <span>Images</span>
        <span className="bg-muted/60 text-foreground/90 rounded px-1 py-px font-medium">
          {blossomOrS3BadgeLabel(uploadProvider)}
        </span>
      </div>
    ) : null;

  return (
    <div>
      <div
        className={cn(
          "border-border/40 bg-card overflow-hidden rounded-lg border",
          "focus-within:border-border/60 focus-within:ring-border/30 focus-within:ring-1"
        )}
      >
        <div className="border-border/20 bg-muted/10 flex min-h-[2.5rem] flex-wrap items-center justify-between gap-2 border-b px-2 py-1 sm:px-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {chromeLeading}
            {uploadHint}
          </div>
          {chromeTrailing ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              {chromeTrailing}
            </div>
          ) : null}
        </div>
        <div
          className={`${showPlaceholder ? PLACEHOLDER_MIN_HEIGHT : EDITOR_MIN_HEIGHT} ${!editorReady ? "pointer-events-none select-none" : ""}`}
          aria-busy={!editorReady}
          aria-label={!editorReady ? "Editor loading" : undefined}
        >
          {showPlaceholder ? (
            <div
              className="text-muted-foreground px-5 py-4 text-sm"
              role="status"
              aria-label="Article content"
            >
              Loading editor…
            </div>
          ) : bodyView === "preview" ? (
            <div className="max-h-[min(70vh,36rem)] overflow-y-auto px-5 py-4">
              <MarkdownPreview
                source={previewMarkdown ?? ""}
                className="prose prose-lg dark:prose-invert max-w-none"
              />
            </div>
          ) : (
            <>
              <TiptapToolbar
                editor={editor}
                onInsertImage={undefined}
                density="editorial"
              />
              <EditorContent
                editor={editor}
                className="prose prose-lg dark:prose-invert max-w-none px-5 py-4 [&_.ProseMirror]:min-h-[min(52vh,26rem)] [&_.ProseMirror]:outline-none"
                aria-label="Article content"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LegacyLongFormContentEditor({
  uploadProvider,
  onOpenAssetBrowser,
  showLabel,
  editorReady,
  editor,
}: Pick<
  LongFormContentEditorProps,
  | "uploadProvider"
  | "onOpenAssetBrowser"
  | "showLabel"
  | "editorReady"
  | "editor"
>) {
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
                  {blossomOrS3BadgeLabel(uploadProvider)}
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
              className="prose prose-lg dark:prose-invert text-muted-foreground max-w-none"
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

export function LongFormContentEditor({
  uploadProvider,
  onOpenAssetBrowser,
  showLabel = true,
  surface = "legacy",
  bodyView = "edit",
  previewMarkdown = "",
  chromeLeading = null,
  chromeTrailing = null,
  editorReady = true,
  editor,
}: LongFormContentEditorProps) {
  if (surface === "editorial") {
    return (
      <EditorialLongFormContentEditor
        uploadProvider={uploadProvider}
        bodyView={bodyView}
        previewMarkdown={previewMarkdown}
        chromeLeading={chromeLeading}
        chromeTrailing={chromeTrailing}
        editorReady={editorReady}
        editor={editor}
      />
    );
  }

  return (
    <LegacyLongFormContentEditor
      uploadProvider={uploadProvider}
      onOpenAssetBrowser={onOpenAssetBrowser}
      showLabel={showLabel}
      editorReady={editorReady}
      editor={editor}
    />
  );
}
