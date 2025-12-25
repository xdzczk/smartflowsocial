import { marked } from "marked";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
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

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ["href", "title"],
  img: ["src", "alt", "title"],
};

const DANGEROUS_PROTOCOLS = [
  "javascript:",
  "data:",
  "vbscript:",
  "file:",
  "about:",
];

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function sanitizeAttribute(
  tagName: string,
  attrName: string,
  attrValue: string,
): string | null {
  const allowedAttrs = ALLOWED_ATTRIBUTES[tagName];
  if (!allowedAttrs || !allowedAttrs.includes(attrName)) {
    return null;
  }

  if (attrName === "href" || attrName === "src") {
    if (!isValidUrl(attrValue)) {
      return null;
    }

    const lowerValue = attrValue.toLowerCase();
    for (const protocol of DANGEROUS_PROTOCOLS) {
      if (lowerValue.startsWith(protocol)) {
        return null;
      }
    }
  }

  return attrValue.trim();
}

function sanitizeHtml(html: string): string {
  return html
    // Remove script tags and all content between them (case-insensitive)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<SCRIPT\b[^>]*>[\s\S]*?<\/SCRIPT>/gi, "")
    // Remove inline event handlers
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/on\w+\s*=\s*[^>\s]*/gi, "")
    // Remove dangerous protocols
    .replace(/javascript:/gi, "")
    .replace(/data:/gi, "")
    .replace(/vbscript:/gi, "")
    // Remove dangerous tags
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, "")
    .replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, "")
    .replace(/<input\b[^>]*>/gi, "")
    .replace(/<textarea\b[^>]*>[\s\S]*?<\/textarea>/gi, "")
    .replace(/<select\b[^>]*>[\s\S]*?<\/select>/gi, "")
    .replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, "")
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/<meta\b[^>]*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
}

export function sanitizeMarkdown(markdown: string): string {
  if (!markdown || typeof markdown !== "string") {
    return "";
  }

  try {
    // Parse markdown to HTML
    let html = marked(markdown, {
      gfm: true,
      breaks: false,
      pedantic: false,
      smartLists: true,
      smartypants: false,
    }) as string;

    // Sanitize links and images by processing the HTML
    html = html.replace(
      /<a\s+([^>]*?)href=["']([^"']*?)["']([^>]*?)>(.*?)<\/a>/gi,
      (match, before, href, after, text) => {
        const sanitizedHref = sanitizeAttribute("a", "href", href);
        if (!sanitizedHref) {
          return text; // Return just the text if href is invalid
        }
        return `<a href="${sanitizedHref}" target="_blank" rel="noopener noreferrer">${text}</a>`;
      }
    );

    html = html.replace(
      /<img\s+([^>]*?)src=["']([^"']*?)["']([^>]*?)>/gi,
      (match, before, src, after) => {
        const sanitizedSrc = sanitizeAttribute("img", "src", src);
        if (!sanitizedSrc) {
          return ""; // Remove image if src is invalid
        }
        return `<img src="${sanitizedSrc}" loading="lazy">`;
      }
    );

    // FIRST: Remove dangerous tags and content (script tags, event handlers, etc.)
    html = sanitizeHtml(html);

    // SECOND: Escape code blocks properly - decode HTML entities first, then escape
    html = html.replace(
      /<pre><code(?: class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/gi,
      (match, lang, code) => {
        // Decode HTML entities that marked might have added, then escape properly
        let decodedCode = code
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&#x27;/g, "'");

        // Now escape properly
        const escapedCode = decodedCode
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");

        if (lang) {
          const sanitizedLang = lang.replace(/[^a-zA-Z0-9-_]/g, "");
          return `<pre><code class="language-${sanitizedLang}">${escapedCode}</code></pre>`;
        }

        return `<pre><code>${escapedCode}</code></pre>`;
      }
    );

    // THIRD: Escape HTML tags that aren't in our allowed list
    // This handles cases like <b>, <i>, etc. that aren't dangerous but should be escaped
    // Store code blocks temporarily to avoid escaping their content
    const codeBlockPlaceholders: { placeholder: string; content: string }[] = [];
    let placeholderIndex = 0;
    
    html = html.replace(/<pre><code[^>]*>[\s\S]*?<\/code><\/pre>/gi, (match) => {
      const placeholder = `__CODE_BLOCK_${placeholderIndex}__`;
      codeBlockPlaceholders.push({ placeholder, content: match });
      placeholderIndex++;
      return placeholder;
    });
    
    // Escape HTML tags that aren't in our allowed list
    html = html.replace(/<(\/?)(?!\/?(?:p|br|strong|em|h[1-6]|ul|ol|li|blockquote|pre|code|a|img)\b)[a-z][^>]*>/gi, (match) => {
      return match
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    });
    
    // Restore code blocks
    codeBlockPlaceholders.forEach(({ placeholder, content }) => {
      html = html.replace(placeholder, content);
    });

    return html;
  } catch (error) {
    console.error("Error sanitizing markdown:", error);
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
