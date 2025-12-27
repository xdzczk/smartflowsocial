import { getPublicKey, finalizeEvent, nip19 } from "nostr-tools";

import type { EditorJSOutput, EditorJSBlock } from "~/features/posts/types/editorjs.types";
import { sanitizeMarkdown } from "~/lib/markdown-sanitizer.server";

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
    created_at: Math.floor(Date.now() / 1000),
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

export function convertEditorJSToMarkdown(editorData: EditorJSOutput): string {
  if (!editorData?.blocks) {
    return "";
  }

  let markdown = "";

  editorData.blocks.forEach((block: EditorJSBlock) => {
    switch (block.type) {
      case "header": {
        const level = typeof block.data.level === "number" ? block.data.level : 1;
        const text = typeof block.data.text === "string" ? block.data.text : "";
        markdown += `${"#".repeat(level)} ${text}\n\n`;
        break;
      }

      case "paragraph": {
        const textValue = block.data.text;
        const text = typeof textValue === "string" ? textValue : "";
        markdown += `${text}\n\n`;
        break;
      }

      case "list":
        if (Array.isArray(block.data.items)) {
          if (block.data.style === "ordered") {
            block.data.items.forEach((item: unknown, index: number) => {
              markdown += `${index + 1}. ${typeof item === "string" ? item : String(item)}\n`;
            });
          } else {
            block.data.items.forEach((item: unknown) => {
              markdown += `- ${typeof item === "string" ? item : String(item)}\n`;
            });
          }
        }
        markdown += "\n";
        break;

      case "quote": {
        const textValue = block.data.text;
        const text = typeof textValue === "string" ? textValue : "";
        const captionValue = block.data.caption;
        const caption = typeof captionValue === "string" ? captionValue : "";
        markdown += `> ${text}\n`;
        if (caption) {
          markdown += `> \n> — ${caption}\n`;
        }
        markdown += "\n";
        break;
      }

      case "code": {
        const codeValue = block.data.code;
        const code = typeof codeValue === "string" ? codeValue : "";
        markdown += "```\n";
        markdown += code;
        markdown += "\n```\n\n";
        break;
      }

      case "linkTool": {
        const link = typeof block.data.link === "string" ? block.data.link : "";
        const meta = block.data.meta && typeof block.data.meta === "object" && "title" in block.data.meta
          ? block.data.meta as { title?: string }
          : { title: undefined };
        if (meta.title) {
          markdown += `[${meta.title}](${link})\n\n`;
        } else {
          markdown += `${link}\n\n`;
        }
        break;
      }

      case "embed": {
        const serviceValue = block.data.service;
        const sourceValue = block.data.source;
        const service = typeof serviceValue === "string" ? serviceValue : "";
        const source = typeof sourceValue === "string" ? sourceValue : "";
        if (service === "youtube") {
          markdown += `[![YouTube Video](https://img.youtube.com/vi/${source}/0.jpg)](${source})\n\n`;
        } else {
          markdown += `${source}\n\n`;
        }
        break;
      }

      case "image": {
        const file = block.data.file && typeof block.data.file === "object" && "url" in block.data.file
          ? block.data.file as { url?: string }
          : { url: undefined };
        const url = typeof block.data.url === "string" ? block.data.url : undefined;
        const imageUrl = file.url ?? url;
        const caption = typeof block.data.caption === "string" ? block.data.caption : undefined;
        if (imageUrl) {
          if (caption?.trim()) {
            markdown += `![${caption}](${imageUrl})\n\n`;
          } else {
            markdown += `![](${imageUrl})\n\n`;
          }
        }
        break;
      }

      default: {
        const textValue = block.data.text;
        const text = typeof textValue === "string" ? textValue : "";
        if (text) {
          markdown += `${text}\n\n`;
        }
        break;
      }
    }
  });

  return markdown.trim();
}

export function convertMarkdownToEditorJS(markdown: string): EditorJSOutput {
  if (!markdown || markdown.trim() === "") {
    return { blocks: [] };
  }

  const blocks: EditorJSBlock[] = [];
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line === "") {
      i++;
      continue;
    }

    // Headers
    if (line.startsWith("#")) {
      const level = line.match(/^#+/)?.[0].length ?? 1;
      const text = line.replace(/^#+\s*/, "");
      blocks.push({
        id: generateBlockId(),
        type: "header",
        data: {
          text: text,
          level: Math.min(Math.max(level, 1), 6),
        },
      });
    }
    // Images
    else if (line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)) {
      const match = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (match) {
        const [, caption, url] = match;
        blocks.push({
          id: generateBlockId(),
          type: "image",
          data: {
            file: {
              url: url,
            },
            caption: caption || "",
            withBorder: false,
            withBackground: false,
            stretched: false,
          },
        });
      }
    }
    // Blockquotes
    else if (line.startsWith("> ")) {
      let quoteText = "";
      let caption = "";

      // Collect all consecutive quote lines
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        const quoteLine = lines[i].trim().substring(2);
        if (quoteLine.startsWith("— ")) {
          caption = quoteLine.substring(2);
        } else if (quoteLine !== "") {
          if (quoteText) quoteText += " ";
          quoteText += quoteLine;
        }
        i++;
      }
      i--; // Adjust for the loop increment

      blocks.push({
        id: generateBlockId(),
        type: "quote",
        data: {
          text: quoteText,
          caption: caption,
        },
      });
    }
    // Code blocks
    else if (line === "```") {
      let code = "";
      i++; // Skip the opening ```

      while (i < lines.length && lines[i].trim() !== "```") {
        if (code) code += "\n";
        code += lines[i];
        i++;
      }

      blocks.push({
        id: generateBlockId(),
        type: "code",
        data: {
          code: code,
        },
      });
    }
    // Ordered lists
    else if (line.match(/^\d+\.\s/)) {
      const items: string[] = [];

      while (i < lines.length && lines[i].trim().match(/^\d+\.\s/)) {
        const item = lines[i].trim().replace(/^\d+\.\s/, "");
        items.push(item);
        i++;
      }
      i--; // Adjust for the loop increment

      blocks.push({
        id: generateBlockId(),
        type: "list",
        data: {
          style: "ordered",
          items: items,
        },
      });
    }
    // Unordered lists
    else if (line.startsWith("- ")) {
      const items: string[] = [];

      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        const item = lines[i].trim().substring(2);
        items.push(item);
        i++;
      }
      i--; // Adjust for the loop increment

      blocks.push({
        id: generateBlockId(),
        type: "list",
        data: {
          style: "unordered",
          items: items,
        },
      });
    }
    // Links (simple detection)
    else if (line.match(/^\[([^\]]+)\]\(([^)]+)\)$/)) {
      const match = line.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (match) {
        const [, title, url] = match;
        blocks.push({
          id: generateBlockId(),
          type: "linkTool",
          data: {
            link: url,
            meta: {
              title: title,
            },
          },
        });
      }
    }
    // Regular paragraphs
    else if (line) {
      // Collect consecutive non-empty lines for paragraph
      let paragraphText = line;
      let j = i + 1;

      while (
        j < lines.length &&
        lines[j].trim() !== "" &&
        !lines[j].trim().startsWith("#") &&
        !lines[j].trim().startsWith("> ") &&
        !lines[j].trim().startsWith("- ") &&
        !lines[j].trim().match(/^\d+\.\s/) &&
        lines[j].trim() !== "```" &&
        !lines[j].trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
      ) {
        paragraphText += " " + lines[j].trim();
        j++;
      }

      blocks.push({
        id: generateBlockId(),
        type: "paragraph",
        data: {
          text: paragraphText,
        },
      });

      i = j - 1; // Set i to the last line we processed
    }

    i++;
  }

  return {
    blocks: blocks,
  };
}

function generateBlockId(): string {
  return Math.random().toString(36).substr(2, 9);
}
