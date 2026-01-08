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
    const data = block.data;

    switch (block.type) {
      case "header": {
        const level = "#".repeat(
          typeof data["level"] === "number" ? data["level"] : 1
        );
        const text = typeof data["text"] === "string" ? data["text"] : "";
        markdown += `${level} ${text}\n\n`;
        break;
      }

      case "paragraph": {
        const text = typeof data["text"] === "string" ? data["text"] : "";
        markdown += `${text}\n\n`;
        break;
      }

      case "list": {
        const style = data["style"];
        const items = Array.isArray(data["items"]) ? data["items"] : [];
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
        markdown += "\n";
        break;
      }

      case "quote": {
        const text = typeof data["text"] === "string" ? data["text"] : "";
        markdown += `> ${text}\n`;
        if (data["caption"] && typeof data["caption"] === "string") {
          markdown += `> \n> — ${data["caption"]}\n`;
        }
        markdown += "\n";
        break;
      }

      case "code": {
        const code = typeof data["code"] === "string" ? data["code"] : "";
        markdown += "```\n";
        markdown += code;
        markdown += "\n```\n\n";
        break;
      }

      case "linkTool": {
        const link = typeof data["link"] === "string" ? data["link"] : "";
        const meta =
          data["meta"] && typeof data["meta"] === "object"
            ? (data["meta"] as Record<string, unknown>)
            : {};
        const title = typeof meta["title"] === "string" ? meta["title"] : null;
        if (title) {
          markdown += `[${title}](${link})\n\n`;
        } else {
          markdown += `${link}\n\n`;
        }
        break;
      }

      case "embed": {
        const service =
          typeof data["service"] === "string" ? data["service"] : "";
        const source = typeof data["source"] === "string" ? data["source"] : "";
        if (service === "youtube") {
          markdown += `[![YouTube Video](https://img.youtube.com/vi/${source}/0.jpg)](${source})\n\n`;
        } else {
          markdown += `${source}\n\n`;
        }
        break;
      }

      case "image": {
        const file =
          data["file"] && typeof data["file"] === "object"
            ? (data["file"] as Record<string, unknown>)
            : null;
        const fileUrl =
          file && typeof file["url"] === "string" ? file["url"] : null;
        const url = typeof data["url"] === "string" ? data["url"] : null;
        const imageUrl = fileUrl ?? url;
        const caption =
          typeof data["caption"] === "string" ? data["caption"] : "";
        if (imageUrl) {
          if (caption.trim()) {
            markdown += `![${caption}](${imageUrl})\n\n`;
          } else {
            markdown += `![](${imageUrl})\n\n`;
          }
        }
        break;
      }

      default: {
        const text = typeof data["text"] === "string" ? data["text"] : null;
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
    const currentLine = lines[i];
    if (currentLine === undefined) break;
    const line = currentLine.trim();

    if (line === "") {
      i++;
      continue;
    }

    // Headers
    if (line.startsWith("#")) {
      const match = line.match(/^#+/);
      const level = match?.[0]?.length ?? 1;
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
        const caption = match[1];
        const url = match[2];
        if (caption !== undefined && url !== undefined) {
          blocks.push({
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
          });
        }
      }
    }
    // Blockquotes
    else if (line.startsWith("> ")) {
      let quoteText = "";
      let caption = "";

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

      while (i < lines.length) {
        const currentLine = lines[i];
        if (currentLine === undefined) break;
        if (currentLine.trim() === "```") break;
        if (code) code += "\n";
        code += currentLine;
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

      while (i < lines.length) {
        const currentLine = lines[i];
        if (currentLine === undefined) break;
        if (!currentLine.trim().match(/^\d+\.\s/)) break;
        const item = currentLine.trim().replace(/^\d+\.\s/, "");
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

      while (i < lines.length) {
        const currentLine = lines[i];
        if (currentLine === undefined) break;
        if (!currentLine.trim().startsWith("- ")) break;
        const item = currentLine.trim().substring(2);
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
        const title = match[1];
        const url = match[2];
        if (title !== undefined && url !== undefined) {
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
    }
    // Regular paragraphs
    else if (line) {
      // Collect consecutive non-empty lines for paragraph
      let paragraphText = line;
      let j = i + 1;

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
