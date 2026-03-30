/**
 * Renders markdown source as HTML with prose styling.
 * Uses marked (GFM) + shared sanitization and Tailwind prose for longform preview/listing.
 */

import { sanitizeMarkdown } from "~/lib/markdown-sanitize";

interface MarkdownPreviewProps {
  source: string;
  className?: string;
}

export function MarkdownPreview({
  source,
  className = "longform-markdown-preview max-w-none text-base leading-relaxed",
}: MarkdownPreviewProps) {
  if (!source || typeof source !== "string") {
    return (
      <div className={className}>
        <p className="text-muted-foreground italic">No content available</p>
      </div>
    );
  }

  const htmlStr = sanitizeMarkdown(source.trim());

  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: htmlStr }} />
  );
}
