import marked from "marked";

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
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/on\w+\s*=\s*[^>\s]*/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/data:/gi, "")
    .replace(/vbscript:/gi, "")
    .replace(/<iframe\b[^>]*>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/<object\b[^>]*>/gi, "")
    .replace(/<form\b[^>]*>/gi, "")
    .replace(/<input\b[^>]*>/gi, "")
    .replace(/<textarea\b[^>]*>/gi, "")
    .replace(/<select\b[^>]*>/gi, "")
    .replace(/<button\b[^>]*>/gi, "")
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/<meta\b[^>]*>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
}

export function sanitizeMarkdown(markdown: string): string {
  if (!markdown || typeof markdown !== "string") {
    return "";
  }

  try {
    const renderer = new marked.Renderer();

    renderer.html = () => "";

    renderer.link = (href, title, text) => {
      const sanitizedHref = sanitizeAttribute("a", "href", href || "");
      if (!sanitizedHref) {
        return text;
      }

      const titleAttr = title
        ? ` title="${title.replace(/"/g, "&quot;")}"`
        : "";
      return `<a href="${sanitizedHref}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
    };

    renderer.image = (src, title, text) => {
      const sanitizedSrc = sanitizeAttribute("img", "src", src || "");
      if (!sanitizedSrc) {
        return text || "";
      }

      const titleAttr = title
        ? ` title="${title.replace(/"/g, "&quot;")}"`
        : "";
      const altAttr = text ? ` alt="${text.replace(/"/g, "&quot;")}"` : "";
      return `<img src="${sanitizedSrc}"${altAttr}${titleAttr} loading="lazy">`;
    };

    renderer.code = (code, language) => {
      const escapedCode = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

      if (language) {
        const sanitizedLang = language.replace(/[^a-zA-Z0-9-_]/g, "");
        return `<pre><code class="language-${sanitizedLang}">${escapedCode}</code></pre>`;
      }

      return `<pre><code>${escapedCode}</code></pre>`;
    };

    const html = marked.marked(markdown, {
      renderer,
      gfm: true,
      breaks: false,
      pedantic: false,
      smartLists: true,
      smartypants: false,
    });

    return sanitizeHtml(html);
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
