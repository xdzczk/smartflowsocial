import { getPublicKey, finalizeEvent, nip19 } from "nostr-tools";

import { sanitizeMarkdown } from "~/lib/markdown-sanitizer.server";
import { nowSeconds } from "~/lib/temporal";

import type { EditorJSOutput, EditorJSBlock } from "./types/editorjs.types";

export function createLongFormEvent({
  privateKey,
  title,
  content,
  summary,
  image,
  tags = [],
  dTag,
  publishedAt,
}: {
  privateKey: string;
  title: string;
  content: string;
  summary?: string;
  image?: string;
  tags?: string[];
  dTag?: string;
  publishedAt?: number;
}) {
  // Convert privateKey (hex string or nsec) to Uint8Array
  let privateKeyBytes: Uint8Array;
  try {
    if (privateKey.startsWith("nsec")) {
      const decoded = nip19.decode(privateKey);
      if (decoded.type === "nsec") {
        privateKeyBytes = decoded.data;
      } else {
        throw new Error("Invalid nsec format");
      }
    } else {
      // Assume hex string
      privateKeyBytes = new Uint8Array(
        privateKey.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? []
      );
    }
  } catch {
    // Fallback: treat as hex string
    privateKeyBytes = new Uint8Array(
      privateKey.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? []
    );
  }

  const publicKey = getPublicKey(privateKeyBytes);

  const eventTags = [];

  if (dTag) {
    eventTags.push(["d", dTag]);
  }

  if (title) {
    eventTags.push(["title", title]);
  }

  if (summary) {
    eventTags.push(["summary", summary]);
  }

  if (image) {
    eventTags.push(["image", image]);
  }

  if (publishedAt) {
    eventTags.push(["published_at", publishedAt.toString()]);
  }

  tags.forEach((tag) => {
    if (tag.trim()) {
      eventTags.push(["t", tag.trim().toLowerCase()]);
    }
  });

  const sanitizedContent = sanitizeMarkdown(content);

  const event = {
    kind: 30023,
    pubkey: publicKey,
    created_at: nowSeconds(),
    tags: eventTags,
    content: sanitizedContent,
  };

  return finalizeEvent(event, privateKeyBytes);
}

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

function convertHeaderBlock(block: EditorJSBlock): string {
  const level =
    typeof block.data["level"] === "number" ? block.data["level"] : 1;
  const text = typeof block.data["text"] === "string" ? block.data["text"] : "";
  return `${"#".repeat(level)} ${text}\n\n`;
}

function convertParagraphBlock(block: EditorJSBlock): string {
  const textValue = block.data["text"];
  const text = typeof textValue === "string" ? textValue : "";
  return `${text}\n\n`;
}

function convertListBlock(block: EditorJSBlock): string {
  if (!Array.isArray(block.data["items"])) {
    return "\n";
  }

  const items = block.data["items"];
  if (!Array.isArray(items)) {
    return "\n";
  }

  let markdown = "";
  if (block.data["style"] === "ordered") {
    items.forEach((item: unknown, index: number) => {
      markdown += `${index + 1}. ${typeof item === "string" ? item : String(item)}\n`;
    });
  } else {
    items.forEach((item: unknown) => {
      markdown += `- ${typeof item === "string" ? item : String(item)}\n`;
    });
  }
  return `${markdown}\n`;
}

function convertQuoteBlock(block: EditorJSBlock): string {
  const textValue = block.data["text"];
  const text = typeof textValue === "string" ? textValue : "";
  const captionValue = block.data["caption"];
  const caption = typeof captionValue === "string" ? captionValue : "";
  let markdown = `> ${text}\n`;
  if (caption) {
    markdown += `> \n> — ${caption}\n`;
  }
  return `${markdown}\n`;
}

function convertCodeBlock(block: EditorJSBlock): string {
  const codeValue = block.data["code"];
  const code = typeof codeValue === "string" ? codeValue : "";
  return `\`\`\`\n${code}\n\`\`\`\n\n`;
}

function convertLinkToolBlock(block: EditorJSBlock): string {
  const link = typeof block.data["link"] === "string" ? block.data["link"] : "";
  const meta =
    block.data["meta"] &&
    typeof block.data["meta"] === "object" &&
    "title" in block.data["meta"]
      ? (block.data["meta"] as { title?: string })
      : { title: undefined };
  if (meta.title) {
    return `[${meta.title}](${link})\n\n`;
  }
  return `${link}\n\n`;
}

function convertEmbedBlock(block: EditorJSBlock): string {
  const serviceValue = block.data["service"];
  const sourceValue = block.data["source"];
  const service = typeof serviceValue === "string" ? serviceValue : "";
  const source = typeof sourceValue === "string" ? sourceValue : "";
  if (service === "youtube") {
    return `[![YouTube Video](https://img.youtube.com/vi/${source}/0.jpg)](${source})\n\n`;
  }
  return `${source}\n\n`;
}

function convertImageBlock(block: EditorJSBlock): string {
  const file =
    block.data["file"] &&
    typeof block.data["file"] === "object" &&
    "url" in block.data["file"]
      ? (block.data["file"] as { url?: string })
      : { url: undefined };
  const url =
    typeof block.data["url"] === "string" ? block.data["url"] : undefined;
  const imageUrl = file.url ?? url;
  const caption =
    typeof block.data["caption"] === "string"
      ? block.data["caption"]
      : undefined;
  if (!imageUrl) {
    return "";
  }
  if (caption?.trim()) {
    return `![${caption}](${imageUrl})\n\n`;
  }
  return `![](${imageUrl})\n\n`;
}

function convertDefaultBlock(block: EditorJSBlock): string {
  const textValue = block.data["text"];
  const text = typeof textValue === "string" ? textValue : "";
  if (text) {
    return `${text}\n\n`;
  }
  return "";
}

function convertBlockToMarkdown(block: EditorJSBlock): string {
  switch (block.type) {
    case "header":
      return convertHeaderBlock(block);
    case "paragraph":
      return convertParagraphBlock(block);
    case "list":
      return convertListBlock(block);
    case "quote":
      return convertQuoteBlock(block);
    case "code":
      return convertCodeBlock(block);
    case "linkTool":
      return convertLinkToolBlock(block);
    case "embed":
      return convertEmbedBlock(block);
    case "image":
      return convertImageBlock(block);
    default:
      return convertDefaultBlock(block);
  }
}

export function convertEditorJSToMarkdown(editorData: EditorJSOutput): string {
  if (editorData.blocks.length === 0) {
    return "";
  }

  let markdown = "";

  editorData.blocks.forEach((block: EditorJSBlock) => {
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
    const currentQuoteLine = lines[i];
    if (currentQuoteLine === undefined) break;
    if (!currentQuoteLine.trim().startsWith("> ")) break;
    const quoteLine = currentQuoteLine.trim().substring(2);
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
    const currentCodeLine = lines[i];
    if (currentCodeLine === undefined) break;
    if (currentCodeLine.trim() === "```") break;
    if (code) code += "\n";
    code += currentCodeLine;
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
    const currentListItem = lines[i];
    if (currentListItem === undefined) break;
    if (!currentListItem.trim().match(/^\d+\.\s/)) break;
    const item = currentListItem.trim().replace(/^\d+\.\s/, "");
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
    const currentListItem = lines[i];
    if (currentListItem === undefined) break;
    if (!currentListItem.trim().startsWith("- ")) break;
    const item = currentListItem.trim().substring(2);
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
    const currentParagraphLine = lines[j];
    if (currentParagraphLine === undefined) break;
    const trimmed = currentParagraphLine.trim();
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

function processMarkdownLine(
  line: string,
  lines: string[],
  index: number
): { block: EditorJSBlock | null; nextIndex: number } {
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

    const result = processMarkdownLine(line, lines, i);
    if (result.block) {
      blocks.push(result.block);
    }
    i = result.nextIndex + 1;
  }

  return {
    blocks: blocks,
  };
}

function generateBlockId(): string {
  return Math.random().toString(36).substr(2, 9);
}
