/**
 * Renders markdown source as HTML with prose styling.
 * Uses marked (GFM) and Tailwind prose for longform preview/listing.
 */

import { marked } from "marked";

interface MarkdownPreviewProps {
  source: string;
  className?: string;
}

const markedOptions: Parameters<typeof marked>[1] = {
  gfm: true,
  breaks: false,
};

export function MarkdownPreview({
  source,
  className = "prose prose-lg dark:prose-invert max-w-none",
}: MarkdownPreviewProps) {
  if (!source || typeof source !== "string") {
    return (
      <div className={className}>
        <p className="text-muted-foreground italic">No content available</p>
      </div>
    );
  }

  const html = marked(source.trim(), markedOptions);
  const htmlStr = String(html);

  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: htmlStr }} />
  );
}
