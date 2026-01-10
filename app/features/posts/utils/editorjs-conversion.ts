/**
 * EditorJS conversion utilities
 * Converts between EditorJS format and Markdown
 */

import type { EditorJSBlock, EditorJSOutput } from "../types/editorjs.types";

function generateBlockId(): string {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Generate article identifier from title (for NIP-23 long-form posts)
 */
export function generateArticleIdentifier(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .substring(0, 64);
}

// ============================================================================
// EditorJS to Markdown Conversion Helpers
// ============================================================================

function convertHeaderBlockToMarkdown(block: EditorJSBlock): string {
  const data = block.data;
  const level = "#".repeat(
    typeof data["level"] === "number" ? data["level"] : 1
  );
  const text = typeof data["text"] === "string" ? data["text"] : "";
  return `${level} ${text}\n\n`;
}

function convertParagraphBlockToMarkdown(block: EditorJSBlock): string {
  const data = block.data;
  const text = typeof data["text"] === "string" ? data["text"] : "";
  return `${text}\n\n`;
}

function convertListBlockToMarkdown(block: EditorJSBlock): string {
  const data = block.data;
  const style = data["style"];
  const items = Array.isArray(data["items"]) ? data["items"] : [];
  let markdown = "";
  if (style === "ordered") {
    items.forEach((item: unknown, index: number) => {
      const itemText = typeof item === "string" ? item : String(item);
      markdown += `${index + 1}. ${itemText}\n`;
    });
  } else {
    items.forEach((item: unknown) => {
      const itemText = typeof item === "string" ? item : String(item);
      markdown += `- ${itemText}\n`;
    });
  }
  return `${markdown}\n`;
}

function convertQuoteBlockToMarkdown(block: EditorJSBlock): string {
  const data = block.data;
  const text = typeof data["text"] === "string" ? data["text"] : "";
  let markdown = `> ${text}\n`;
  if (data["caption"] && typeof data["caption"] === "string") {
    markdown += `> \n> — ${data["caption"]}\n`;
  }
  return `${markdown}\n`;
}

function convertCodeBlockToMarkdown(block: EditorJSBlock): string {
  const data = block.data;
  const code = typeof data["code"] === "string" ? data["code"] : "";
  return `\`\`\`\n${code}\n\`\`\`\n\n`;
}

function convertLinkToolBlockToMarkdown(block: EditorJSBlock): string {
  const data = block.data;
  const link = typeof data["link"] === "string" ? data["link"] : "";
  const meta =
    data["meta"] && typeof data["meta"] === "object"
      ? (data["meta"] as Record<string, unknown>)
      : {};
  const title = typeof meta["title"] === "string" ? meta["title"] : null;
  if (title) {
    return `[${title}](${link})\n\n`;
  }
  return `${link}\n\n`;
}

function convertEmbedBlockToMarkdown(block: EditorJSBlock): string {
  const data = block.data;
  const service = typeof data["service"] === "string" ? data["service"] : "";
  const source = typeof data["source"] === "string" ? data["source"] : "";
  if (service === "youtube") {
    return `[![YouTube Video](https://img.youtube.com/vi/${source}/0.jpg)](${source})\n\n`;
  }
  return `${source}\n\n`;
}

function convertImageBlockToMarkdown(block: EditorJSBlock): string {
  const data = block.data;
  const file =
    data["file"] && typeof data["file"] === "object"
      ? (data["file"] as Record<string, unknown>)
      : null;
  const fileUrl = file && typeof file["url"] === "string" ? file["url"] : null;
  const url = typeof data["url"] === "string" ? data["url"] : null;
  const imageUrl = fileUrl ?? url;
  const caption = typeof data["caption"] === "string" ? data["caption"] : "";
  if (!imageUrl) {
    return "";
  }
  if (caption.trim()) {
    return `![${caption}](${imageUrl})\n\n`;
  }
  return `![](${imageUrl})\n\n`;
}

function convertDefaultBlockToMarkdown(block: EditorJSBlock): string {
  const data = block.data;
  const text = typeof data["text"] === "string" ? data["text"] : null;
  if (text) {
    return `${text}\n\n`;
  }
  return "";
}

function convertBlockToMarkdown(block: EditorJSBlock): string {
  switch (block.type) {
    case "header":
      return convertHeaderBlockToMarkdown(block);
    case "paragraph":
      return convertParagraphBlockToMarkdown(block);
    case "list":
      return convertListBlockToMarkdown(block);
    case "quote":
      return convertQuoteBlockToMarkdown(block);
    case "code":
      return convertCodeBlockToMarkdown(block);
    case "linkTool":
      return convertLinkToolBlockToMarkdown(block);
    case "embed":
      return convertEmbedBlockToMarkdown(block);
    case "image":
      return convertImageBlockToMarkdown(block);
    default:
      return convertDefaultBlockToMarkdown(block);
  }
}

export function convertEditorJSToMarkdown(
  editorData: EditorJSOutput | string | null | undefined
): string {
  // Handle string input (JSON string)
  let parsedData: EditorJSOutput | null = null;
  if (typeof editorData === "string") {
    try {
      parsedData = JSON.parse(editorData) as EditorJSOutput;
    } catch {
      return "";
    }
  } else if (editorData && typeof editorData === "object") {
    parsedData = editorData;
  }

  if (!parsedData?.blocks || !Array.isArray(parsedData.blocks)) {
    return "";
  }

  let markdown = "";

  parsedData.blocks.forEach((block: EditorJSBlock) => {
    markdown += convertBlockToMarkdown(block);
  });

  return markdown.trim();
}

// ============================================================================
// Markdown Parser Helpers
// ============================================================================

interface ParseResult {
  block: EditorJSBlock | null;
  nextIndex: number;
}

function processMarkdownLineForEditorJS(
  line: string,
  lines: string[],
  index: number
): ParseResult {
  // Headers
  if (line.startsWith("#")) {
    const block = parseHeader(line);
    return { block, nextIndex: index };
  }

  // Images
  if (line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)) {
    const block = parseImage(line);
    return { block, nextIndex: index };
  }

  // Blockquotes
  if (line.startsWith("> ")) {
    return parseBlockquote(lines, index);
  }

  // Code blocks
  if (line === "```") {
    return parseCodeBlock(lines, index);
  }

  // Ordered lists
  if (line.match(/^\d+\.\s/)) {
    return parseOrderedList(lines, index);
  }

  // Unordered lists
  if (line.startsWith("- ")) {
    return parseUnorderedList(lines, index);
  }

  // Links
  if (line.match(/^\[([^\]]+)\]\(([^)]+)\)$/)) {
    const block = parseLink(line);
    return { block, nextIndex: index };
  }

  // Regular paragraphs
  return parseParagraph(lines, index);
}

function parseHeader(line: string): EditorJSBlock | null {
  const match = line.match(/^#+/);
  const level = match?.[0]?.length ?? 1;
  const text = line.replace(/^#+\s*/, "");
  return {
    id: generateBlockId(),
    type: "header",
    data: {
      text: text,
      level: Math.min(Math.max(level, 1), 6),
    },
  };
}

function parseImage(line: string): EditorJSBlock | null {
  const match = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  if (!match) {
    return null;
  }
  const caption = match[1];
  const url = match[2];
  if (caption === undefined || url === undefined) {
    return null;
  }
  return {
    id: generateBlockId(),
    type: "image",
    data: {
      file: {
        url: url,
      },
      caption: caption,
      withBorder: false,
      withBackground: false,
      stretched: false,
    },
  };
}

function parseBlockquote(lines: string[], startIndex: number): ParseResult {
  let quoteText = "";
  let caption = "";
  let i = startIndex;

  // Collect all consecutive quote lines
  while (i < lines.length) {
    const currentLine = lines[i];
    if (currentLine === undefined) break;
    if (!currentLine.trim().startsWith("> ")) break;
    const quoteLine = currentLine.trim().substring(2);
    if (quoteLine.startsWith("— ")) {
      caption = quoteLine.substring(2);
    } else if (quoteLine !== "") {
      if (quoteText) quoteText += " ";
      quoteText += quoteLine;
    }
    i++;
  }

  return {
    block: {
      id: generateBlockId(),
      type: "quote",
      data: {
        text: quoteText,
        caption: caption,
      },
    },
    nextIndex: i - 1, // Adjust for the loop increment
  };
}

function parseCodeBlock(lines: string[], startIndex: number): ParseResult {
  let code = "";
  let i = startIndex + 1; // Skip the opening ```

  while (i < lines.length) {
    const currentLine = lines[i];
    if (currentLine === undefined) break;
    if (currentLine.trim() === "```") break;
    if (code) code += "\n";
    code += currentLine;
    i++;
  }

  return {
    block: {
      id: generateBlockId(),
      type: "code",
      data: {
        code: code,
      },
    },
    nextIndex: i,
  };
}

function parseOrderedList(lines: string[], startIndex: number): ParseResult {
  const items: string[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const currentLine = lines[i];
    if (currentLine === undefined) break;
    if (!currentLine.trim().match(/^\d+\.\s/)) break;
    const item = currentLine.trim().replace(/^\d+\.\s/, "");
    items.push(item);
    i++;
  }

  return {
    block: {
      id: generateBlockId(),
      type: "list",
      data: {
        style: "ordered",
        items: items,
      },
    },
    nextIndex: i - 1, // Adjust for the loop increment
  };
}

function parseUnorderedList(lines: string[], startIndex: number): ParseResult {
  const items: string[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const currentLine = lines[i];
    if (currentLine === undefined) break;
    if (!currentLine.trim().startsWith("- ")) break;
    const item = currentLine.trim().substring(2);
    items.push(item);
    i++;
  }

  return {
    block: {
      id: generateBlockId(),
      type: "list",
      data: {
        style: "unordered",
        items: items,
      },
    },
    nextIndex: i - 1, // Adjust for the loop increment
  };
}

function parseLink(line: string): EditorJSBlock | null {
  const match = line.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (!match) {
    return null;
  }
  const title = match[1];
  const url = match[2];
  if (title === undefined || url === undefined) {
    return null;
  }
  return {
    id: generateBlockId(),
    type: "linkTool",
    data: {
      link: url,
      meta: {
        title: title,
      },
    },
  };
}

function parseParagraph(lines: string[], startIndex: number): ParseResult {
  const line = lines[startIndex];
  if (line === undefined) {
    return { block: null, nextIndex: startIndex };
  }

  let paragraphText = line.trim();
  let j = startIndex + 1;

  while (j < lines.length) {
    const currentLine = lines[j];
    if (currentLine === undefined) break;
    const trimmed = currentLine.trim();
    if (
      trimmed === "" ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("> ") ||
      trimmed.startsWith("- ") ||
      trimmed.match(/^\d+\.\s/) ||
      trimmed === "```" ||
      trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    ) {
      break;
    }
    paragraphText += " " + trimmed;
    j++;
  }

  return {
    block: {
      id: generateBlockId(),
      type: "paragraph",
      data: {
        text: paragraphText,
      },
    },
    nextIndex: j - 1, // Set to the last line we processed
  };
}

// ============================================================================
// Markdown to EditorJS Conversion Helpers
// ============================================================================

export function convertMarkdownToEditorJS(markdown: string): EditorJSOutput {
  if (!markdown || markdown.trim() === "") {
    return { blocks: [] };
  }

  const blocks: EditorJSBlock[] = [];
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const currentLine = lines[i];
    if (currentLine === undefined) break;
    const line = currentLine.trim();

    if (line === "") {
      i++;
      continue;
    }

    const result = processMarkdownLineForEditorJS(line, lines, i);
    if (result.block) {
      blocks.push(result.block);
    }
    i = result.nextIndex + 1;
  }

  return {
    blocks: blocks,
  };
}
