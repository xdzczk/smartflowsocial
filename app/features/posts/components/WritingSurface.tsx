/**
 * Writing Surface (hero) for Long-form Composer v2.
 * Centered column: inline title + body editor. No form-field look.
 */

import { useEffect, useRef } from "react";

import { LongFormContentEditor } from "./LongFormContentEditor";

function getWordCount(content: string): number {
  if (!content || typeof content !== "string") return 0;
  try {
    const data = JSON.parse(content) as {
      blocks?: Array<{ data?: { text?: string } }>;
    };
    const blocks = data.blocks ?? [];
    const text = blocks.map((b) => b.data?.text ?? "").join(" ");
    return text.trim().split(/\s+/).filter(Boolean).length;
  } catch {
    return content.trim().split(/\s+/).filter(Boolean).length;
  }
}

interface WritingSurfaceProps {
  title: string;
  onTitleChange: (value: string) => void;
  content?: string;
  uploadProvider?: string | null;
  onOpenAssetBrowser: () => void;
}

export function WritingSurface({
  title,
  onTitleChange,
  content = "",
  uploadProvider,
  onOpenAssetBrowser,
}: WritingSurfaceProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const wordCount = getWordCount(content);

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
        className="text-foreground placeholder:text-muted-foreground mb-6 w-full border-0 bg-transparent text-3xl leading-tight font-semibold outline-none focus:ring-0 dark:text-white"
        aria-label="Article title"
      />
      <LongFormContentEditor
        uploadProvider={uploadProvider}
        onOpenAssetBrowser={onOpenAssetBrowser}
        showLabel={false}
      />
      {wordCount > 0 ? (
        <p className="text-muted-foreground mt-2 text-right text-xs">
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </p>
      ) : null}
    </div>
  );
}
