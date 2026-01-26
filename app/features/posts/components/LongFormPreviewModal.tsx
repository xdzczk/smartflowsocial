import { Button } from "~/components/ui/button";
import { handleErrorSafely } from "~/lib/error-handler.client";
import { formatForDisplay, nowUTC } from "~/lib/temporal";

import type { EditorJSBlock } from "../types/editorjs.types";

// ============================================================================
// EditorJS to HTML Conversion Helpers
// ============================================================================

function convertHeaderBlock(block: EditorJSBlock): string {
  const levelValue = block.data["level"];
  const level = typeof levelValue === "number" ? levelValue : 3;
  const levelStr = String(level);
  const textValue = block.data["text"];
  const text = typeof textValue === "string" ? textValue : "";
  const sizeClass = level === 2 ? "2xl" : level === 3 ? "xl" : "lg";
  return `<h${levelStr} class="text-${sizeClass} font-bold mb-4 text-foreground dark:text-white">${text}</h${levelStr}>`;
}

function convertParagraphBlock(block: EditorJSBlock): string {
  const textValue = block.data["text"];
  const text = typeof textValue === "string" ? textValue : "";
  return `<p class="mb-4 text-muted-foreground dark:text-foreground leading-relaxed">${text}</p>`;
}

function convertListBlock(block: EditorJSBlock): string {
  const listType = block.data["style"] === "ordered" ? "ol" : "ul";
  const listClass =
    block.data["style"] === "ordered" ? "list-decimal" : "list-disc";
  let html = `<${listType} class="${listClass} ml-6 mb-4 text-muted-foreground dark:text-foreground">`;
  if (Array.isArray(block.data["items"])) {
    const items = block.data["items"];
    if (Array.isArray(items)) {
      items.forEach((item: unknown) => {
        const itemStr = typeof item === "string" ? item : "";
        html += `<li class="mb-1">${itemStr}</li>`;
      });
    }
  }
  html += `</${listType}>`;
  return html;
}

function convertQuoteBlock(block: EditorJSBlock): string {
  const text = typeof block.data["text"] === "string" ? block.data["text"] : "";
  const caption =
    typeof block.data["caption"] === "string" ? block.data["caption"] : "";
  return `<blockquote class="border-l-4 border-primary pl-4 py-2 mb-4 italic text-foreground dark:text-foreground bg-muted dark:bg-card rounded-r">
    <p>${text}</p>
    ${caption ? `<footer class="text-sm mt-2">— ${caption}</footer>` : ""}
  </blockquote>`;
}

function convertCodeBlock(block: EditorJSBlock): string {
  const code = typeof block.data["code"] === "string" ? block.data["code"] : "";
  return `<pre class="bg-muted dark:bg-card text-success p-4 rounded-lg mb-4 overflow-x-auto"><code>${code}</code></pre>`;
}

function convertLinkToolBlock(block: EditorJSBlock): string {
  const link = typeof block.data["link"] === "string" ? block.data["link"] : "";
  const meta =
    block.data["meta"] && typeof block.data["meta"] === "object"
      ? (block.data["meta"] as {
          title?: string;
          description?: string;
        })
      : null;
  return `<div class="border border-border dark:border-border rounded-lg p-4 mb-4">
    <a href="${link}" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:underline">
      <div class="font-semibold">${meta?.title ?? link}</div>
      ${meta?.description ? `<div class="text-foreground dark:text-foreground text-sm mt-1">${meta.description}</div>` : ""}
    </a>
  </div>`;
}

function convertEmbedBlock(block: EditorJSBlock): string {
  const embed =
    typeof block.data["embed"] === "string" ? block.data["embed"] : "";
  return `<div class="mb-4">
    <iframe src="${embed}" class="w-full aspect-video rounded-lg" frameborder="0" allowfullscreen></iframe>
  </div>`;
}

function convertImageBlock(block: EditorJSBlock): string {
  const file =
    block.data["file"] && typeof block.data["file"] === "object"
      ? (block.data["file"] as { url?: string })
      : null;
  const url = typeof block.data["url"] === "string" ? block.data["url"] : "";
  const imageUrl = file?.url ?? url;
  const caption =
    typeof block.data["caption"] === "string" ? block.data["caption"] : "";
  if (!imageUrl) {
    return "";
  }
  return `<figure class="mb-6">
    <img src="${imageUrl}" alt="${caption}" class="w-full rounded-lg shadow-sm" style="max-height: 500px; object-fit: contain;" />
    ${caption ? `<figcaption class="text-center text-sm text-foreground dark:text-foreground mt-2 italic">${caption}</figcaption>` : ""}
  </figure>`;
}

function convertDefaultBlock(block: EditorJSBlock): string {
  if (typeof block.data["text"] === "string") {
    return `<p class="mb-4 text-muted-foreground dark:text-foreground">${block.data["text"]}</p>`;
  }
  const file =
    block.data["file"] && typeof block.data["file"] === "object"
      ? (block.data["file"] as { url?: string })
      : null;
  if (file?.url) {
    return `<div class="mb-4">
      <img src="${file.url}" alt="" class="w-full rounded-lg" style="max-height: 400px; object-fit: contain;" />
    </div>`;
  }
  return "";
}

interface LongFormPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  summary: string;
  content: string;
  image: string;
  displayedHashtags: string;
  author?: string;
}

export default function LongFormPreviewModal({
  isOpen,
  onClose,
  title,
  summary,
  content,
  image,
  displayedHashtags,
  author = "You",
}: LongFormPreviewModalProps) {
  if (!isOpen) return null;

  const convertEditorJSToHTML = (content: string) => {
    if (!content || content.trim() === "") {
      return '<p class="text-muted-foreground italic">No content available</p>';
    }

    try {
      const editorData = JSON.parse(content) as { blocks?: EditorJSBlock[] };

      if (!editorData.blocks || !Array.isArray(editorData.blocks)) {
        return '<p class="text-muted-foreground italic">No content blocks found</p>';
      }

      let html = "";

      editorData.blocks.forEach((block: EditorJSBlock) => {
        switch (block.type) {
          case "header":
            html += convertHeaderBlock(block);
            break;
          case "paragraph":
            html += convertParagraphBlock(block);
            break;
          case "list":
            html += convertListBlock(block);
            break;
          case "quote":
            html += convertQuoteBlock(block);
            break;
          case "code":
            html += convertCodeBlock(block);
            break;
          case "linkTool":
            html += convertLinkToolBlock(block);
            break;
          case "embed":
            html += convertEmbedBlock(block);
            break;
          case "image":
            html += convertImageBlock(block);
            break;
          default:
            html += convertDefaultBlock(block);
        }
      });

      return (
        html ||
        '<p class="text-muted-foreground italic">Content could not be rendered</p>'
      );
    } catch (error) {
      handleErrorSafely(error, {
        component: "LongFormPreviewModal",
        action: "parseEditorJSContent",
      });
      // Try to display as plain text if JSON parsing fails
      const plainTextContent = content.replace(/<[^>]*>/g, "");
      return `<p class="text-muted-foreground dark:text-foreground">${plainTextContent || "Content parsing failed"}</p>`;
    }
  };

  const formatDate = () => {
    const now = nowUTC();
    return formatForDisplay(now, "UTC", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleBackdropKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="bg-opacity-50 absolute inset-0 bg-black"
        onClick={onClose}
        onKeyDown={handleBackdropKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div className="dark:bg-card relative mx-4 max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="border-border dark:border-border flex items-center justify-between border-b p-6">
          <h2 className="text-foreground text-lg font-semibold dark:text-white">
            Preview: How your post will look
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-muted-foreground hover:text-muted-foreground dark:text-foreground dark:hover:text-foreground"
          >
            ✕ Close
          </Button>
        </div>

        {/* Content */}
        <div className="dark:bg-card max-h-[calc(90vh-120px)] overflow-y-auto bg-white">
          {/* Article Card Preview - matches the Primal/Nostr style */}
          <div className="mx-auto max-w-2xl p-6">
            {/* Author Header */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-lg font-semibold text-white">
                {author.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-foreground font-semibold dark:text-white">
                  {author}
                </div>
              </div>
              <div className="ml-auto">
                <svg
                  className="text-foreground h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                  />
                </svg>
              </div>
            </div>

            {/* Date and Source */}
            <div className="text-muted-foreground dark:text-foreground mb-4 flex items-center gap-2 text-sm">
              <span>{formatDate()}</span>
              <span>•</span>
              <span>via SmartFlow</span>
              <div className="ml-auto">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-foreground mb-4 text-2xl leading-tight font-bold dark:text-white">
              {title || "Untitled Post"}
            </h1>

            {/* Cover Image */}
            {image ? (
              <div className="mb-4 overflow-hidden rounded-2xl">
                <img
                  src={image}
                  alt="Cover"
                  className="h-80 w-full object-cover"
                />
              </div>
            ) : null}

            {/* Summary */}
            {summary ? (
              <div className="dark:bg-card bg-muted mb-6 rounded-xl p-6">
                <p className="text-muted-foreground dark:text-foreground text-lg leading-relaxed font-medium">
                  {summary}
                </p>
              </div>
            ) : null}

            {/* Full Content */}
            <div
              className="prose prose-lg dark:prose-invert text-foreground mb-6 max-w-none dark:text-white"
              style={{
                fontSize: "1.1rem",
                lineHeight: "1.7",
                color: "inherit",
              }}
              dangerouslySetInnerHTML={{
                __html: convertEditorJSToHTML(content),
              }}
            />

            {/* Zap Button */}
            <div className="flex items-center gap-3">
              {/* Hashtags */}
              {displayedHashtags ? (
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-muted-foreground dark:text-foreground text-xs">
                    {displayedHashtags}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
