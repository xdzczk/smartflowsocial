import { useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

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
      return '<p class="text-gray-500 italic">No content available</p>';
    }

    try {
      const editorData = JSON.parse(content);

      if (!editorData.blocks || !Array.isArray(editorData.blocks)) {
        return '<p class="text-gray-500 italic">No content blocks found</p>';
      }

      let html = "";

      editorData.blocks.forEach((block: any) => {
        switch (block.type) {
          case "header":
            const level = block.data.level || 3;
            html += `<h${level} class="text-${level === 2 ? "2xl" : level === 3 ? "xl" : "lg"} font-bold mb-4 text-gray-900 dark:text-white">${block.data.text}</h${level}>`;
            break;
          case "paragraph":
            html += `<p class="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed">${block.data.text}</p>`;
            break;
          case "list":
            const listType = block.data.style === "ordered" ? "ol" : "ul";
            const listClass =
              block.data.style === "ordered" ? "list-decimal" : "list-disc";
            html += `<${listType} class="${listClass} ml-6 mb-4 text-gray-700 dark:text-gray-300">`;
            block.data.items?.forEach((item: string) => {
              html += `<li class="mb-1">${item}</li>`;
            });
            html += `</${listType}>`;
            break;
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
          case "image":
            const imageUrl = block.data.file?.url || block.data.url;
            const caption = block.data.caption || "";
            if (imageUrl) {
              html += `<figure class="mb-6">
                <img src="${imageUrl}" alt="${caption}" class="w-full rounded-lg shadow-sm" style="max-height: 500px; object-fit: contain;" />
                ${caption ? `<figcaption class="text-center text-sm text-gray-600 dark:text-gray-400 mt-2 italic">${caption}</figcaption>` : ""}
              </figure>`;
            }
            break;
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
      console.error("Error parsing EditorJS content:", error);
      // Try to display as plain text if JSON parsing fails
      const plainTextContent = content.replace(/<[^>]*>/g, "");
      return `<p class="text-gray-700 dark:text-gray-300">${plainTextContent || "Content parsing failed"}</p>`;
    }
  };

  const formatDate = () => {
    return new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative mx-4 max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Preview: How your post will look
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            ✕ Close
          </Button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(90vh-120px)] overflow-y-auto bg-white dark:bg-gray-900">
          {/* Article Card Preview - matches the Primal/Nostr style */}
          <div className="mx-auto max-w-2xl p-6">
            {/* Author Header */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-lg font-semibold text-white">
                {author.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {author}
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

            {/* Date and Source */}
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
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
            <h1 className="mb-4 text-2xl font-bold leading-tight text-gray-900 dark:text-white">
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
              <div className="mb-6 rounded-xl bg-gray-50 p-6 dark:bg-gray-800">
                <p className="text-lg font-medium leading-relaxed text-gray-700 dark:text-gray-300">
                  {summary}
                </p>
              </div>
            ) : null}

            {/* Full Content */}
            <div
              className="prose prose-lg dark:prose-invert mb-6 max-w-none text-gray-900 dark:text-white"
              style={{
                fontSize: "1.1rem",
                lineHeight: "1.7",
                color: "inherit",
              }}
              dangerouslySetInnerHTML={{
                __html: convertEditorJSToHTML(content || ""),
              }}
            />

            {/* Zap Button */}
            <div className="flex items-center gap-3">
              {/* Hashtags */}
              {displayedHashtags ? (
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
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
