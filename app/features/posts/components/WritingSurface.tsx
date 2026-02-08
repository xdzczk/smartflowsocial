/**
 * Writing Surface (hero) for Long-form Composer v2.
 * Centered column: inline title + body editor. No form-field look.
 */

import { useEffect, useRef } from "react";

import { LongFormContentEditor } from "./LongFormContentEditor";

interface WritingSurfaceProps {
  title: string;
  onTitleChange: (value: string) => void;
  content?: string;
  uploadProvider?: string | null;
  onOpenAssetBrowser: () => void;
  /** When false, show a visible placeholder in the editor area until EditorJS is ready */
  editorReady?: boolean;
}

export function WritingSurface({
  title,
  onTitleChange,
  content: _content = "",
  uploadProvider,
  onOpenAssetBrowser,
  editorReady = false,
}: WritingSurfaceProps) {
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-6">
      <input
        ref={titleRef}
        type="text"
        name="title"
        id="title"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Write a title… or don't. You can fix it later."
        className="text-foreground placeholder:text-muted-foreground mb-8 w-full border-0 bg-transparent text-4xl leading-tight font-semibold tracking-tight outline-none focus:ring-0 dark:text-white"
        aria-label="Article title"
      />
      <LongFormContentEditor
        uploadProvider={uploadProvider}
        onOpenAssetBrowser={onOpenAssetBrowser}
        showLabel={false}
        editorReady={editorReady}
      />
    </div>
  );
}
