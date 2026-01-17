import { useFetcher, Link } from "@remix-run/react";
import { useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type {
  LongFormPostType,
  LongFormPostData,
} from "~/features/posts/server";
import { handleErrorSafely } from "~/lib/error-handler.client";
import {
  formatForDisplay,
  fromDate,
  fromISOString,
  fromUnixTimestamp,
} from "~/lib/temporal";

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
  return `<h${levelStr} class="text-${sizeClass} font-bold mb-4 text-gray-900 dark:text-white">${text}</h${levelStr}>`;
}

function convertParagraphBlock(block: EditorJSBlock): string {
  const textValue = block.data["text"];
  const text = typeof textValue === "string" ? textValue : "";
  return `<p class="mb-4 text-gray-700 dark:text-300 leading-relaxed">${text}</p>`;
}

function convertListBlock(block: EditorJSBlock): string {
  const listType = block.data["style"] === "ordered" ? "ol" : "ul";
  const listClass =
    block.data["style"] === "ordered" ? "list-decimal" : "list-disc";
  let html = `<${listType} class="${listClass} ml-6 mb-4 text-gray-700 dark:text-gray-300">`;
  if (Array.isArray(block.data["items"])) {
    const items = block.data["items"];
    if (Array.isArray(items)) {
      items.forEach((item: string) => {
        html += `<li class="mb-1">${item}</li>`;
      });
    }
  }
  html += `</${listType}>`;
  return html;
}

function convertQuoteBlock(block: EditorJSBlock): string {
  const textValue = block.data["text"];
  const text = typeof textValue === "string" ? textValue : "";
  const captionValue = block.data["caption"];
  const caption = typeof captionValue === "string" ? captionValue : "";
  return `<blockquote class="border-l-4 border-blue-500 pl-4 py-2 mb-4 italic text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-r">
    <p>${text}</p>
    ${caption ? `<footer class="text-sm mt-2">— ${caption}</footer>` : ""}
  </blockquote>`;
}

function convertCodeBlock(block: EditorJSBlock): string {
  const codeValue = block.data["code"];
  const code = typeof codeValue === "string" ? codeValue : "";
  return `<pre class="bg-gray-900 dark:bg-gray-800 text-green-400 p-4 rounded-lg mb-4 overflow-x-auto"><code>${code}</code></pre>`;
}

function convertLinkToolBlock(block: EditorJSBlock): string {
  const link = typeof block.data["link"] === "string" ? block.data["link"] : "";
  const meta =
    typeof block.data["meta"] === "object" && block.data["meta"] !== null
      ? (block.data["meta"] as {
          title?: string;
          description?: string;
        })
      : null;
  return `<div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
    <a href="${link}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">
      <div class="font-semibold">${meta?.title ?? link}</div>
      ${meta?.description ? `<div class="text-gray-600 dark:text-gray-400 text-sm mt-1">${meta.description}</div>` : ""}
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
    typeof block.data["file"] === "object" && block.data["file"] !== null
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
    ${caption ? `<figcaption class="text-center text-sm text-gray-600 dark:text-gray-400 mt-2 italic">${caption}</figcaption>` : ""}
  </figure>`;
}

function convertDefaultBlock(block: EditorJSBlock): string {
  if (typeof block.data["text"] === "string") {
    return `<p class="mb-4 text-gray-700 dark:text-gray-300">${block.data["text"]}</p>`;
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

interface LongFormDetailsModalProps {
  post: LongFormPostType | LongFormPostData;
  onClose: () => void;
  type: "draft" | "scheduled" | "posted";
  showSignedEvent?: boolean;
  userTimezone?: string;
}

export default function LongFormDetailsModal({
  post,
  onClose,
  type,
  showSignedEvent = false,
  userTimezone = "UTC",
}: LongFormDetailsModalProps) {
  const [showEventData, setShowEventData] = useState(false);
  const deleteFetcher = useFetcher();

  const convertEditorJSToHTML = (content: string) => {
    if (!content || content.trim() === "") {
      return '<p class="text-gray-500 italic">No content available</p>';
    }

    try {
      const editorData = JSON.parse(content) as { blocks?: EditorJSBlock[] };

      if (!editorData.blocks || !Array.isArray(editorData.blocks)) {
        return '<p class="text-gray-500 italic">No content blocks found</p>';
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
        '<p class="text-gray-500 italic">Content could not be rendered</p>'
      );
    } catch (error) {
      handleErrorSafely(error, {
        component: "LongFormDetailsModal",
        action: "parseEditorJSContent",
      });
      // Try to display as plain text if JSON parsing fails
      const plainTextContent = content.replace(/<[^>]*>/g, "");
      return `<p class="text-gray-700 dark:text-gray-300">${plainTextContent}</p>`;
    }
  };

  const formatDate = (dateInput?: string | Date | number) => {
    if (!dateInput) return "—";

    try {
      let zonedDateTime;
      if (typeof dateInput === "string") {
        // Check if it's a Unix timestamp string
        const unixTimestamp = parseInt(dateInput, 10);
        if (!isNaN(unixTimestamp) && dateInput.length <= 13) {
          // Unix timestamp (seconds or milliseconds)
          const timestamp =
            dateInput.length <= 10
              ? unixTimestamp
              : Math.floor(unixTimestamp / 1000);
          zonedDateTime = fromUnixTimestamp(timestamp, "UTC");
        } else {
          // ISO string
          zonedDateTime = fromISOString(String(dateInput), "UTC");
        }
      } else if (typeof dateInput === "number") {
        // Unix timestamp (seconds or milliseconds)
        const timestamp =
          dateInput.toString().length <= 10
            ? dateInput
            : Math.floor(dateInput / 1000);
        zonedDateTime = fromUnixTimestamp(timestamp, "UTC");
      } else {
        // Date object
        zonedDateTime = fromDate(new Date(dateInput), "UTC");
      }

      // Convert to user's timezone for display
      const userZoned = zonedDateTime.withTimeZone(userTimezone);
      return formatForDisplay(userZoned, userTimezone, {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch (error) {
      handleErrorSafely(error, {
        component: "LongFormDetailsModal",
        action: "formatDate",
      });
      // Fallback to simple date formatting
      const dateObj =
        typeof dateInput === "string"
          ? new Date(dateInput)
          : typeof dateInput === "number"
            ? new Date(dateInput * 1000)
            : dateInput;
      return dateObj.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
  };

  const getReadingTime = (content?: string) => {
    if (!content) return "0 min read";

    try {
      let wordCount = 0;

      // If it's JSON (EditorJS format), extract text from blocks
      if (content.startsWith("{")) {
        const editorData = JSON.parse(content) as { blocks?: EditorJSBlock[] };
        editorData.blocks?.forEach((block: EditorJSBlock) => {
          if (block.type === "paragraph" || block.type === "header") {
            const text =
              typeof block.data["text"] === "string"
                ? block.data["text"].replace(/<[^>]*>/g, "")
                : "";
            wordCount += text
              .split(/\s+/)
              .filter((word: string) => word.length > 0).length;
          } else if (block.type === "list") {
            const items = Array.isArray(block.data["items"])
              ? block.data["items"]
              : [];
            items.forEach((item: unknown) => {
              const text =
                typeof item === "string" ? item.replace(/<[^>]*>/g, "") : "";
              wordCount += text
                .split(/\s+/)
                .filter((word: string) => word.length > 0).length;
            });
          }
        });
      } else {
        // Plain text or markdown
        const text = content.replace(/<[^>]*>/g, "");
        wordCount = text.split(/\s+/).filter((word) => word.length > 0).length;
      }

      const readingTime = Math.ceil(wordCount / 200); // Average 200 words per minute
      return `${readingTime} min read`;
    } catch {
      return "— min read";
    }
  };

  const getStatusBadge = () => {
    if (type === "draft") {
      return (
        <Badge
          variant="secondary"
          className="bg-orange-100 text-orange-900 dark:bg-orange-700/10 dark:text-orange-200"
        >
          Draft
        </Badge>
      );
    } else if (type === "scheduled") {
      return (
        <Badge
          variant="secondary"
          className="bg-blue-100 text-blue-900 dark:bg-blue-700/10 dark:text-blue-200"
        >
          Scheduled
        </Badge>
      );
    } else {
      return (
        <Badge
          variant="secondary"
          className="bg-green-100 text-green-900 dark:bg-green-700/10 dark:text-green-200"
        >
          Published
        </Badge>
      );
    }
  };

  const getModalTitle = () => {
    if (type === "draft") return "Draft Article";
    if (type === "scheduled") return "Scheduled Article";
    return "Published Article";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-900">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 px-6 py-4 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/95">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {getModalTitle()}
              </h2>
              {getStatusBadge()}
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Preview Panel */}
          <div className="flex-1 overflow-y-auto">
            {/* Article Preview - Primal/NOSTR style */}
            <div className="mx-auto max-w-3xl p-6">
              {/* Author Header */}
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-lg font-semibold text-white">
                  A
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    You
                  </div>
                </div>
                <div className="ml-auto">
                  <svg
                    className="h-6 w-6 text-gray-400"
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

              {/* Date and Reading Time */}
              <div className="mb-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>
                  {formatDate(
                    type === "posted"
                      ? (post.publishedAt ?? undefined)
                      : type === "scheduled"
                        ? (post.scheduledFor ?? undefined)
                        : post.createdAt
                  )}
                </span>
                <span>•</span>
                <span>{getReadingTime(post.content ?? undefined)}</span>
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
              <h1 className="mb-6 text-3xl leading-tight font-bold text-gray-900 dark:text-white">
                {post.title ?? "Untitled Article"}
              </h1>

              {/* Cover Image */}
              {post.image ? (
                <div className="mb-6 overflow-hidden rounded-2xl">
                  <img
                    src={post.image}
                    alt="Cover"
                    className="h-80 w-full object-cover"
                  />
                </div>
              ) : null}

              {/* Summary */}
              {post.summary ? (
                <div className="mb-6 rounded-xl bg-gray-50 p-6 dark:bg-gray-800">
                  <p className="text-lg leading-relaxed font-medium text-gray-700 dark:text-gray-300">
                    {post.summary}
                  </p>
                </div>
              ) : null}

              {/* Content */}
              <div
                className="prose prose-lg dark:prose-invert max-w-none text-gray-900 dark:text-white"
                style={{
                  fontSize: "1.1rem",
                  lineHeight: "1.7",
                  color: "inherit",
                }}
                dangerouslySetInnerHTML={{
                  __html: convertEditorJSToHTML(post.content ?? ""),
                }}
              />

              {/* Tags */}
              {post.tags.length > 0 ? (
                <div className="mt-8 flex items-center gap-2 border-t border-gray-200 pt-6 dark:border-gray-700">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="cursor-pointer text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* Details Sidebar */}
          <div className="w-80 overflow-y-auto border-l border-gray-200 dark:border-gray-700">
            <div className="space-y-6 p-6">
              <div>
                <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Article Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Status
                    </span>
                    <div className="mt-1">{getStatusBadge()}</div>
                  </div>

                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {type === "posted"
                        ? "Published"
                        : type === "scheduled"
                          ? "Scheduled For"
                          : "Created"}
                    </span>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {formatDate(
                        type === "posted"
                          ? (post.publishedAt ?? undefined)
                          : type === "scheduled"
                            ? (post.scheduledFor ?? undefined)
                            : post.createdAt
                      )}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Reading Time
                    </span>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {getReadingTime(post.content ?? undefined)}
                    </p>
                  </div>

                  {post.tags.length > 0 ? (
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Tags
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {post.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Signed Event Data */}
              {showSignedEvent && post.signedEvent ? (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Signed Event Data
                    </h3>
                    <button
                      onClick={() => setShowEventData(!showEventData)}
                      className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {showEventData ? "Hide" : "Show"}
                    </button>
                  </div>
                  {showEventData ? (
                    <div className="rounded-lg bg-gray-100 p-3 dark:bg-gray-800">
                      <pre className="max-h-64 overflow-auto text-xs break-words whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                        {JSON.stringify(post.signedEvent, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-gray-200 bg-white/95 px-6 py-4 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/95">
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              {type === "posted" &&
              (post.nostrEventId ??
                (typeof post.signedEvent === "object" &&
                post.signedEvent !== null &&
                "id" in post.signedEvent
                  ? (post.signedEvent as { id?: string }).id
                  : undefined)) ? (
                <Link
                  to={`https://primal.net/a/${String(post.nostrEventId ?? (typeof post.signedEvent === "object" && post.signedEvent !== null && "id" in post.signedEvent ? (post.signedEvent as { id?: string }).id : "") ?? "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none dark:bg-gray-700 dark:hover:bg-gray-600"
                >
                  View Article
                </Link>
              ) : null}

              {type === "draft" ? (
                <Link
                  to={`/dashboard/drafts/longform/edit/${post.id}`}
                  className="inline-flex items-center rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-800 transition-colors hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:bg-blue-950/50"
                >
                  Edit Draft
                </Link>
              ) : null}
            </div>

            <div className="flex gap-3">
              <deleteFetcher.Form
                method="post"
                onClick={(e) => e.stopPropagation()}
              >
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="_action" value="deleteLongForm" />
                <button
                  type="submit"
                  disabled={deleteFetcher.state !== "idle"}
                  className="inline-flex items-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50 dark:border-red-600 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-950/50"
                >
                  {deleteFetcher.state !== "idle" &&
                  deleteFetcher.formData?.get("postId") === post.id
                    ? "Deleting..."
                    : "Delete"}
                </button>
              </deleteFetcher.Form>

              <Button onClick={onClose}>Close</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
