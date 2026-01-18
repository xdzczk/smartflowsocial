import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

import { logError } from "./error-logger.server";

/**
 * Allowed HTML tags for markdown content
 */
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "b",
  "i",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "a",
  "img",
];

/**
 * Allowed attributes per tag
 */
const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "title", "loading"],
  code: ["class"],
};

/**
 * Sanitizes markdown content by parsing it to HTML and then sanitizing the HTML
 * Uses sanitize-html library for robust XSS protection
 *
 * @param markdown - The markdown string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeMarkdown(markdown: string): string {
  if (!markdown || typeof markdown !== "string") {
    return "";
  }

  try {
    // Parse markdown to HTML using marked
    const markedOptions: Parameters<typeof marked>[1] = {
      gfm: true,
      breaks: false,
      pedantic: false,
      smartLists: true,
      smartypants: false,
    };
    const htmlResult = marked(markdown, markedOptions);
    const html =
      typeof htmlResult === "string" ? htmlResult : String(htmlResult);

    // Preserve code blocks before sanitization
    // sanitize-html will escape code block content, which we want to preserve as-is
    const codeBlockPlaceholders: Array<{
      placeholder: string;
      content: string;
    }> = [];
    let placeholderIndex = 0;

    // Extract code blocks and replace with placeholders
    // Use a unique placeholder that won't be modified by sanitize-html
    const htmlWithPlaceholders = html.replace(
      /<pre><code(?: class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/gi,
      (match, lang, code) => {
        const placeholder = `__CODE_BLOCK_PLACEHOLDER_${placeholderIndex}__`;
        const codeStr = typeof code === "string" ? code : String(code ?? "");
        const langStr = typeof lang === "string" ? lang : String(lang ?? "");

        // Sanitize language class name
        const sanitizedLang = langStr.replace(/[^a-zA-Z0-9-_]/g, "");

        // Preserve the code block content (it's already HTML-escaped by marked)
        // We'll restore it after sanitization
        codeBlockPlaceholders.push({
          placeholder,
          content: sanitizedLang
            ? `<pre><code class="language-${sanitizedLang}">${codeStr}</code></pre>`
            : `<pre><code>${codeStr}</code></pre>`,
        });
        placeholderIndex++;
        return placeholder;
      }
    );

    // Sanitize HTML using sanitize-html library
    const sanitized = sanitizeHtml(htmlWithPlaceholders, {
      allowedTags: ALLOWED_TAGS,
      allowedAttributes: ALLOWED_ATTRIBUTES,
      allowedSchemes: ["http", "https"],
      allowedSchemesByTag: {
        img: ["http", "https", "data"], // Allow data URIs for images if needed
      },
      allowedSchemesAppliedToAttributes: ["href", "src"],
      // Ensure links open in new tab with security attributes
      transformTags: {
        a: (tagName, attribs) => {
          return {
            tagName: "a",
            attribs: {
              ...attribs,
              target: "_blank",
              rel: "noopener noreferrer",
            },
          };
        },
        img: (tagName, attribs) => {
          return {
            tagName: "img",
            attribs: {
              ...attribs,
              loading: "lazy",
            },
          };
        },
      },
    });

    // Restore code blocks (placeholders should remain unchanged by sanitize-html)
    let finalHtml = sanitized;
    codeBlockPlaceholders.forEach(({ placeholder, content }) => {
      finalHtml = finalHtml.replace(placeholder, content);
    });

    return finalHtml;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Error sanitizing markdown",
    });
    return "";
  }
}

export function extractPlainText(markdown: string): string {
  if (!markdown || typeof markdown !== "string") {
    return "";
  }

  return markdown
    .replace(/#+\s*/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/!\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/>\s*/g, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function generateSummary(content: string, maxLength = 280): string {
  const plainText = extractPlainText(content);
  if (plainText.length <= maxLength) {
    return plainText;
  }

  const truncated = plainText.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + "...";
  }

  return truncated + "...";
}
