/**
 * Tiptap toolbar: paragraph, headings, emphasis, quote, link, image, divider.
 * Grouped for long-form editorial flow.
 */

import type { Editor } from "@tiptap/core";
import { Image as ImageIcon, Link, Minus, Quote } from "lucide-react";
import type { ReactNode } from "react";

import { Separator } from "~/components/ui/separator";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

interface TiptapToolbarProps {
  editor: Editor | null;
  onInsertImage?: () => void;
  /** `editorial` — quieter chrome for article composer; `default` — modal / legacy. */
  density?: "default" | "editorial";
  /**
   * When `density="editorial`: `standalone` — own card strip; `embedded` — under mode row;
   * `inComposerCanvas` — inside main composer card; slightly stronger band for the writing surface.
   */
  editorialChrome?: "standalone" | "embedded" | "inComposerCanvas";
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
  "aria-label": ariaLabel,
  editorial,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: ReactNode;
  "aria-label": string;
  editorial?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={cn(
        "motion-fast",
        editorial
          ? "text-text-secondary hover:bg-surface-hover/50 hover:text-text rounded-md px-1.5 py-1 text-xs"
          : "rounded-md px-2 py-1.5 text-sm",
        !editorial &&
          (active
            ? "bg-brand/15 text-brand"
            : "text-text-secondary hover:bg-surface-hover hover:text-text"),
        editorial &&
          (active
            ? "bg-surface-hover/45 text-text/95"
            : "text-text-secondary/85 hover:bg-surface-hover/40 hover:text-text"),
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      {children}
    </button>
  );
}

export function TiptapToolbar({
  editor,
  onInsertImage,
  density = "default",
  editorialChrome = "standalone",
}: TiptapToolbarProps) {
  if (!editor) return null;

  const editorial = density === "editorial";
  const editorialEmbedded = editorial && editorialChrome === "embedded";
  const editorialInCanvas = editorial && editorialChrome === "inComposerCanvas";

  const setLink = () => {
    const linkAttrs = editor.getAttributes("link") as { href?: string };
    const previousUrl: string | undefined =
      typeof linkAttrs["href"] === "string" ? linkAttrs["href"] : undefined;
    const url = window.prompt("URL", previousUrl ?? "https://");
    if (url == null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center",
        editorialInCanvas
          ? "border-border/25 bg-surface-hover/10 gap-x-1 gap-y-0.5 border-t px-2.5 py-2 sm:px-3"
          : editorialEmbedded
            ? "border-border/10 gap-x-1 gap-y-0.5 border-t bg-transparent px-2 py-1.5 sm:px-2.5"
            : "gap-0.5 border-b",
        editorial && !editorialEmbedded && !editorialInCanvas
          ? "border-border/15 bg-transparent px-2 py-1"
          : !editorial && "border-border bg-surface-hover/40 px-2 py-1.5"
      )}
    >
      <ToolbarButton
        editorial={editorial}
        onClick={() => editor.chain().focus().setParagraph().run()}
        active={
          editor.isActive("paragraph") && !editor.isActive("heading")
            ? !editor.isActive("blockquote")
            : false
        }
        title="Paragraph"
        aria-label="Paragraph"
      >
        <span className="text-xs font-medium">¶</span>
      </ToolbarButton>
      <ToolbarButton
        editorial={editorial}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
        aria-label="Heading 2"
      >
        <span className="text-xs font-semibold">H2</span>
      </ToolbarButton>
      <ToolbarButton
        editorial={editorial}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
        aria-label="Heading 3"
      >
        <span className="text-xs font-semibold">H3</span>
      </ToolbarButton>
      <ToolbarButton
        editorial={editorial}
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Bold"
        aria-label="Bold"
      >
        <span className={cn("font-bold", editorial ? "text-xs" : "text-sm")}>
          B
        </span>
      </ToolbarButton>
      <ToolbarButton
        editorial={editorial}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Italic"
        aria-label="Italic"
      >
        <span className={cn("italic", editorial ? "text-xs" : "text-sm")}>
          I
        </span>
      </ToolbarButton>
      <ToolbarButton
        editorial={editorial}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        title="Quote"
        aria-label="Block quote"
      >
        <Quote
          className={INLINE_ICON_SIZE_CLASS}
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
      </ToolbarButton>
      <Separator
        orientation="vertical"
        className={cn(
          "mx-1",
          editorialInCanvas
            ? "bg-border/30 h-5"
            : editorialEmbedded
              ? "bg-border/20 h-[1.125rem]"
              : editorial
                ? "bg-border/25 h-5"
                : "h-6"
        )}
      />
      <ToolbarButton
        editorial={editorial}
        onClick={setLink}
        active={editor.isActive("link")}
        title="Link"
        aria-label="Insert link"
      >
        <Link
          className={INLINE_ICON_SIZE_CLASS}
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
      </ToolbarButton>
      <ToolbarButton
        editorial={editorial}
        onClick={() => {
          if (onInsertImage) {
            onInsertImage();
          } else {
            const src = window.prompt("Image URL", "https://");
            if (src) editor.chain().focus().setImage({ src }).run();
          }
        }}
        title="Image"
        aria-label="Insert image"
      >
        <ImageIcon
          className={INLINE_ICON_SIZE_CLASS}
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
      </ToolbarButton>
      <ToolbarButton
        editorial={editorial}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Divider"
        aria-label="Insert horizontal divider"
      >
        <Minus
          className={INLINE_ICON_SIZE_CLASS}
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
      </ToolbarButton>
    </div>
  );
}
