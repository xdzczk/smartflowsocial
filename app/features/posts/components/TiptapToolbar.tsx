/**
 * Minimal Tiptap toolbar: Bold, Italic, H2, H3, Link, Image.
 * Uses editor.chain().focus().toggleBold() etc.; Tailwind styled.
 */

import type { Editor } from "@tiptap/core";
import { Image as ImageIcon, Link } from "lucide-react";

import { Separator } from "~/components/ui/separator";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";

interface TiptapToolbarProps {
  editor: Editor | null;
  onInsertImage?: () => void;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
  "aria-label": ariaLabel,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={`rounded p-1.5 transition-colors ${
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      {children}
    </button>
  );
}

export function TiptapToolbar({ editor, onInsertImage }: TiptapToolbarProps) {
  if (!editor) return null;

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
    <div className="border-border bg-muted/30 flex flex-wrap items-center gap-0.5 border-b px-2 py-1">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Bold"
        aria-label="Bold"
      >
        <span className="text-sm font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Italic"
        aria-label="Italic"
      >
        <span className="text-sm italic">I</span>
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-0.5 h-full" />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
        aria-label="Heading 2"
      >
        <span className="text-xs font-semibold">H2</span>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
        aria-label="Heading 3"
      >
        <span className="text-xs font-semibold">H3</span>
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-0.5 h-full" />
      <ToolbarButton
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
    </div>
  );
}
