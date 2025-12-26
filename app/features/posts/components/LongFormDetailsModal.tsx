import { useFetcher, Link } from "@remix-run/react";
import { useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type { EditorJSBlock } from "~/features/posts/types/editorjs.types";
import { handleErrorSafely } from "~/lib/error-handler.client";
import type { LongFormPost } from "~/models/longformpost.server";

interface LongFormDetailsModalProps {
  post: LongFormPost;
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
      const editorData = JSON.parse(content);

      if (!editorData.blocks || !Array.isArray(editorData.blocks)) {
        return '<p class="text-gray-500 italic">No content blocks found</p>';
      }

      let html = "";

      editorData.blocks.forEach((block: EditorJSBlock) => {
        switch (block.type) {
          case "header": {
            const level = block.data.level || 3;
            html += `<h${level} class="text-${level === 2 ? "2xl" : level === 3 ? "xl" : "lg"} font-bold mb-4 text-gray-900 dark:text-white">${block.data.text}</h${level}>`;
            break;
          }
          case "paragraph":
            html += `<p class="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed">${block.data.text}</p>`;
            break;
          case "list": {
            const listType = block.data.style === "ordered" ? "ol" : "ul";
            const listClass =
              block.data.style === "ordered" ? "list-decimal" : "list-disc";
            html += `<${listType} class="${listClass} ml-6 mb-4 text-gray-700 dark:text-gray-300">`;
            block.data.items?.forEach((item: string) => {
              html += `<li class="mb-1">${item}</li>`;
            });
            html += `</${listType}>`;
            break;
          }
          case "quote":
            html += `<blockquote class="border-l-4 border-blue-500 pl-4 py-2 mb-4 italic text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-r">
              <p>${block.data.text}</p>
              ${block.data.caption ? `<footer class="text-sm mt-2">— ${block.data.caption}</footer>` : ""}
            </blockquote>`;
            break;
          case "code":
            html += `<pre class="bg-gray-900 dark:bg-gray-800 text-green-400 p-4 rounded-lg mb-4 overflow-x-auto"><code>${block.data.code}</code></pre>`;
            break;
          case "linkTool":
            html += `<div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
              <a href="${block.data.link}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">
                <div class="font-semibold">${block.data.meta?.title || block.data.link}</div>
                ${block.data.meta?.description ? `<div class="text-gray-600 dark:text-gray-400 text-sm mt-1">${block.data.meta.description}</div>` : ""}
              </a>
            </div>`;
            break;
          case "embed":
            html += `<div class="mb-4">
              <iframe src="${block.data.embed}" class="w-full aspect-video rounded-lg" frameborder="0" allowfullscreen></iframe>
            </div>`;
            break;
          case "image": {
            const imageUrl = block.data.file?.url || block.data.url;
            const caption = block.data.caption || "";
            if (imageUrl) {
              html += `<figure class="mb-6">
                <img src="${imageUrl}" alt="${caption}" class="w-full rounded-lg shadow-sm" style="max-height: 500px; object-fit: contain;" />
                ${caption ? `<figcaption class="text-center text-sm text-gray-600 dark:text-gray-400 mt-2 italic">${caption}</figcaption>` : ""}
              </figure>`;
            }
            break;
          }
          default:
            if (block.data.text) {
              html += `<p class="mb-4 text-gray-700 dark:text-gray-300">${block.data.text}</p>`;
            } else if (block.data.file?.url) {
              // Handle any other block types that might have images
              html += `<div class="mb-4">
                <img src="${block.data.file.url}" alt="" class="w-full rounded-lg" style="max-height: 400px; object-fit: contain;" />
              </div>`;
            }
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
      return `<p class="text-gray-700 dark:text-gray-300">${plainTextContent || "Content parsing failed"}</p>`;
    }
  };

  const formatDate = (dateInput?: string | Date | number) => {
    if (!dateInput) return "—";

    let date: Date;

    // Handle different input formats
    if (typeof dateInput === "string") {
      // Check if it's a Unix timestamp string
      const unixTimestamp = parseInt(dateInput);
      if (!isNaN(unixTimestamp) && dateInput.length <= 13) {
        // Unix timestamp (seconds or milliseconds)
        date = new Date(unixTimestamp * (dateInput.length <= 10 ? 1000 : 1));
      } else {
        // ISO string
        date = new Date(dateInput);
      }
    } else if (typeof dateInput === "number") {
      // Unix timestamp (seconds or milliseconds)
      date = new Date(
        dateInput * (dateInput.toString().length <= 10 ? 1000 : 1),
      );
    } else {
      // Date object
      date = new Date(dateInput);
    }

    return date.toLocaleString("en-US", {
      timeZone: userTimezone,
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getReadingTime = (content?: string) => {
    if (!content) return "0 min read";

    try {
      let wordCount = 0;

      // If it's JSON (EditorJS format), extract text from blocks
      if (content.startsWith("{")) {
        const editorData = JSON.parse(content);
        editorData.blocks?.forEach((block: EditorJSBlock) => {
          if (block.type === "paragraph" || block.type === "header") {
            const text = block.data.text?.replace(/<[^>]*>/g, "") || "";
            wordCount += text
              .split(/\s+/)
              .filter((word) => word.length > 0).length;
          } else if (block.type === "list") {
            block.data.items?.forEach((item: string) => {
              const text = item.replace(/<[^>]*>/g, "");
              wordCount += text
                .split(/\s+/)
                .filter((word) => word.length > 0).length;
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
                      ? post.publishedAt
                      : type === "scheduled"
                        ? post.scheduledFor
                        : post.createdAt,
                  )}
                </span>
                <span>•</span>
                <span>{getReadingTime(post.content)}</span>
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
              <h1 className="mb-6 text-3xl font-bold leading-tight text-gray-900 dark:text-white">
                {post.title || "Untitled Article"}
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
                  <p className="text-lg font-medium leading-relaxed text-gray-700 dark:text-gray-300">
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
                  __html: convertEditorJSToHTML(post.content || ""),
                }}
              />

              {/* Tags */}
              {post.tags && post.tags.length > 0 ? (
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
                          ? post.publishedAt
                          : type === "scheduled"
                            ? post.scheduledFor
                            : post.createdAt,
                      )}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Reading Time
                    </span>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {getReadingTime(post.content)}
                    </p>
                  </div>

                  {post.tags && post.tags.length > 0 ? (
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
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-800 dark:text-gray-200">
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
                (post.nostrEventId || post.signedEvent?.id) ? (
                <Link
                  to={`https://primal.net/a/${post.nostrEventId || post.signedEvent?.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:bg-gray-700 dark:hover:bg-gray-600"
                >
                  View Article
                </Link>
              ) : null}

              {type === "draft" ? (
                <Link
                  to={`/dashboard/drafts/longform/edit/${post.id}`}
                  className="inline-flex items-center rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-800 transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:bg-blue-950/50"
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
                  className="inline-flex items-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 dark:border-red-600 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-950/50"
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
