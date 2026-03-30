import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

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

export interface SanitizeMarkdownOptions {
  /** Called when parsing or sanitization fails (e.g. server-side logging). */
  onError?: (error: unknown) => void;
}

/**
 * Sanitizes markdown content by parsing it to HTML and then sanitizing the HTML.
 * Safe for use in the browser (e.g. previews) and on the server (persisted content).
 */
export function sanitizeMarkdown(
  markdown: string,
  options?: SanitizeMarkdownOptions
): string {
  if (!markdown || typeof markdown !== "string") {
    return "";
  }

  try {
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

    const codeBlockPlaceholders: Array<{
      placeholder: string;
      content: string;
    }> = [];
    let placeholderIndex = 0;

    const htmlWithPlaceholders = html.replace(
      /<pre><code(?: class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/gi,
      (match, lang, code) => {
        const placeholder = `__CODE_BLOCK_PLACEHOLDER_${placeholderIndex}__`;
        const codeStr = typeof code === "string" ? code : String(code ?? "");
        const langStr = typeof lang === "string" ? lang : String(lang ?? "");

        const sanitizedLang = langStr.replace(/[^a-zA-Z0-9-_]/g, "");

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

    const sanitized = sanitizeHtml(htmlWithPlaceholders, {
      allowedTags: ALLOWED_TAGS,
      allowedAttributes: ALLOWED_ATTRIBUTES,
      allowedSchemes: ["http", "https"],
      allowedSchemesByTag: {
        img: ["http", "https", "data"],
      },
      allowedSchemesAppliedToAttributes: ["href", "src"],
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

    let finalHtml = sanitized;
    codeBlockPlaceholders.forEach(({ placeholder, content }) => {
      finalHtml = finalHtml.replace(placeholder, content);
    });

    return finalHtml;
  } catch (error) {
    options?.onError?.(error);
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
