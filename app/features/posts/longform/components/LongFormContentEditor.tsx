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
  /**
   * When true with `surface="editorial"`, editor sits inside `ComposerLeftCanvas` — no nested card chrome.
   */
  containedInComposerCard?: boolean;
}

const EDITORIAL_EDITOR_MIN_HEIGHT = "min-h-[min(58vh,32rem)]";
const EDITORIAL_PLACEHOLDER_MIN_HEIGHT = "min-h-[min(58vh,32rem)]";
const LEGACY_EDITOR_MIN_HEIGHT = "min-h-[min(56vh,29rem)]";
const LEGACY_PLACEHOLDER_MIN_HEIGHT = "min-h-[min(56vh,29rem)]";

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
  containedInComposerCard = false,
}: Pick<
  LongFormContentEditorProps,
  | "uploadProvider"
  | "bodyView"
  | "previewMarkdown"
  | "chromeLeading"
  | "chromeTrailing"
  | "editorReady"
  | "editor"
  | "containedInComposerCard"
>) {
  const showPlaceholder = !editor;
  const uploadHint =
    uploadProvider != null ? (
      <div className="text-muted-foreground/40 hidden items-center gap-1.5 text-[10px] sm:flex">
        <span className="text-muted-foreground/50">Images</span>
        <span className="font-medium tabular-nums">
          {blossomOrS3BadgeLabel(uploadProvider)}
        </span>
      </div>
    ) : null;

  const editorProseClasses =
    "prose prose-lg dark:prose-invert max-w-none px-5 py-5 sm:px-6 sm:py-6 " +
    "[&_.ProseMirror]:min-h-[min(54vh,28rem)] [&_.ProseMirror]:outline-none " +
    "[&_.ProseMirror_p.is-empty[data-placeholder]::before]:pointer-events-none " +
    "[&_.ProseMirror_p.is-empty[data-placeholder]::before]:float-left " +
    "[&_.ProseMirror_p.is-empty[data-placeholder]::before]:h-0 " +
    "[&_.ProseMirror_p.is-empty[data-placeholder]::before]:text-muted-foreground/45 " +
    "[&_.ProseMirror_p.is-empty[data-placeholder]::before]:content-[attr(data-placeholder)]";

  return (
    <div>
      <div
        className={cn(
          "overflow-hidden",
          containedInComposerCard
            ? "border-border/20 bg-muted/[0.04] rounded-lg border"
            : [
                "border-border/35 bg-card/40 rounded-xl border",
                "shadow-sm shadow-black/[0.02] dark:shadow-black/20",
                "focus-within:border-border/55 focus-within:ring-border/20 focus-within:ring-1",
              ]
        )}
      >
        <div
          className={cn(
            "border-b",
            containedInComposerCard
              ? "border-border/20 bg-muted/10"
              : "border-border/15 bg-muted/[0.06]"
          )}
        >
          <div className="flex min-h-[2.35rem] flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 sm:px-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
              {chromeLeading}
              {uploadHint}
            </div>
            {chromeTrailing ? (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                {chromeTrailing}
              </div>
            ) : null}
          </div>
          {!showPlaceholder && bodyView === "edit" ? (
            <TiptapToolbar
              editor={editor}
              onInsertImage={undefined}
              density="editorial"
              editorialChrome={
                containedInComposerCard ? "inComposerCanvas" : "embedded"
              }
            />
          ) : null}
        </div>
        <div
          className={cn(
            showPlaceholder
              ? EDITORIAL_PLACEHOLDER_MIN_HEIGHT
              : EDITORIAL_EDITOR_MIN_HEIGHT,
            !editorReady && "pointer-events-none select-none",
            containedInComposerCard ? "bg-background/60" : "bg-background/50"
          )}
          aria-busy={!editorReady}
          aria-label={!editorReady ? "Editor loading" : undefined}
        >
          {showPlaceholder ? (
            <div
              className="text-muted-foreground/70 flex h-full flex-col justify-center px-6 py-8 text-sm leading-relaxed"
              role="status"
              aria-label="Article content"
            >
              <p className="text-foreground/80 font-medium tracking-tight">
                Preparing your writing surface…
              </p>
              <p className="text-muted-foreground/65 mt-1 max-w-md text-[13px]">
                The editor loads in a moment. Your draft stays in this page.
              </p>
            </div>
          ) : bodyView === "preview" ? (
            <div className="max-h-[min(72vh,38rem)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <MarkdownPreview
                source={previewMarkdown ?? ""}
                className="prose prose-lg dark:prose-invert max-w-none"
              />
            </div>
          ) : (
            <EditorContent
              editor={editor}
              className={editorProseClasses}
              aria-label="Article content"
            />
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
          className={`${showPlaceholder ? LEGACY_PLACEHOLDER_MIN_HEIGHT : LEGACY_EDITOR_MIN_HEIGHT} p-4 ${!editorReady ? "pointer-events-none select-none" : ""}`}
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
  containedInComposerCard = false,
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
        containedInComposerCard={containedInComposerCard}
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
