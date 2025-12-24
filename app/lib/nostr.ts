import { nip19 } from "nostr-tools";

import type {
  NostrEventData,
  NostrEvent,
  SignedEvent,
  SignEventResult,
  LongFormEventData,
} from "~/features/nostr/types";

declare global {
  interface Window {
    nostr?: any;
  }
}

export function hexToNpub(hex: string): string | null {
  try {
    return nip19.npubEncode(hex);
  } catch (error) {
    console.error("Error converting hex to npub:", error);
    return null;
  }
}

export function npubToHex(npub: string): string | null {
  try {
    if (!npub.startsWith("npub")) {
      return npub;
    }
    const { data } = nip19.decode(npub);
    return data as string;
  } catch (error) {
    console.error("Error converting npub to hex:", error);
    return null;
  }
}

export const signEventFn = async (
  eventData: NostrEventData,
): Promise<SignEventResult> => {
  try {
    // Add retry logic to handle extension loading
    let retries = 0;
    const maxRetries = 5;

    while (retries < maxRetries) {
      if (window.nostr) {
        const nostrEvent: NostrEvent = {
          content: eventData.content,
          created_at: eventData.created_at,
          kind: eventData.kind || 1,
          tags: eventData.tags || [],
        };

        const signResult = await window.nostr.signEvent(nostrEvent);

        // Handle different return types from different extensions
        const signedEvent: SignedEvent = {
          id: signResult?.id || "unknown",
          pubkey: signResult?.pubkey || "unknown",
          created_at: nostrEvent.created_at,
          kind: nostrEvent.kind,
          tags: nostrEvent.tags,
          content: nostrEvent.content,
          sig:
            typeof signResult === "string"
              ? signResult
              : signResult?.sig || "unknown",
        };

        return { nostrEvent, signedEvent };
      }

      retries++;

      // Wait 500ms between retries
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(
      "Nostr extension not found after retries. Please install a Nostr extension.",
    );
  } catch (error) {
    console.error("Error in signEventFn:", error);
    throw error;
  }
};

export const signLongFormEvent = async (
  eventData: LongFormEventData,
): Promise<SignEventResult> => {
  try {
    // Add retry logic to handle extension loading
    let retries = 0;
    const maxRetries = 5;

    while (retries < maxRetries) {
      if (window.nostr) {
        // Build NIP-23 tags
        const eventTags: string[][] = [];

        // Add title tag
        if (eventData.title) {
          eventTags.push(["title", eventData.title]);
        }
        // Add relay tag
        eventTags.push(["r", "wss://relay.primal.net/"]);
        // Add client tag
        eventTags.push(["client", "SmartFlow"]);
        // Add summary tag
        if (eventData.summary) {
          eventTags.push(["summary", eventData.summary]);
        }

        // Add image tag
        if (eventData.image) {
          eventTags.push(["image", eventData.image]);
        }

        // Add identifier tag (d tag for replaceable events)
        if (eventData.identifier) {
          eventTags.push(["d", eventData.identifier]);
        }

        // Add published_at tag
        if (eventData.publishedAt) {
          eventTags.push(["published_at", eventData.publishedAt.toString()]);
        }

        // Add topic tags (t tags)
        if (eventData.tags && eventData.tags.length > 0) {
          eventData.tags.forEach((tag) => {
            if (tag.trim()) {
              eventTags.push(["t", tag.trim().toLowerCase()]);
            }
          });
        }

        const nostrEvent: NostrEvent = {
          content: eventData.content,
          created_at: Math.floor(Date.now() / 1000),
          kind: 30023, // NIP-23 long-form content
          tags: eventTags,
        };

        const signResult = await window.nostr.signEvent(nostrEvent);

        // Handle different return types from different extensions
        const signedEvent: SignedEvent = {
          id: signResult?.id || "unknown",
          pubkey: signResult?.pubkey || "unknown",
          created_at: nostrEvent.created_at,
          kind: nostrEvent.kind,
          tags: nostrEvent.tags,
          content: nostrEvent.content,
          sig:
            typeof signResult === "string"
              ? signResult
              : signResult?.sig || "unknown",
        };

        return { nostrEvent, signedEvent };
      }

      retries++;

      // Wait 500ms between retries
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(
      "Nostr extension not found after retries. Please install a Nostr extension.",
    );
  } catch (error) {
    console.error("Error in signLongFormEvent:", error);
    throw error;
  }
};

export function generateArticleIdentifier(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .substring(0, 64);
}

export function convertEditorJSToMarkdown(editorData: any): string {
  if (!editorData || !editorData.blocks) {
    return "";
  }

  let markdown = "";

  editorData.blocks.forEach((block: any) => {
    switch (block.type) {
      case "header": {
        const level = "#".repeat(block.data.level || 1);
        markdown += `${level} ${block.data.text}\n\n`;
        break;
      }

      case "paragraph":
        markdown += `${block.data.text}\n\n`;
        break;

      case "list":
        if (block.data.style === "ordered") {
          block.data.items.forEach((item: string, index: number) => {
            markdown += `${index + 1}. ${item}\n`;
          });
        } else {
          block.data.items.forEach((item: string) => {
            markdown += `- ${item}\n`;
          });
        }
        markdown += "\n";
        break;

      case "quote":
        markdown += `> ${block.data.text}\n`;
        if (block.data.caption) {
          markdown += `> \n> — ${block.data.caption}\n`;
        }
        markdown += "\n";
        break;

      case "code":
        markdown += "```\n";
        markdown += block.data.code;
        markdown += "\n```\n\n";
        break;

      case "linkTool": {
        const { link, meta } = block.data;
        if (meta.title) {
          markdown += `[${meta.title}](${link})\n\n`;
        } else {
          markdown += `${link}\n\n`;
        }
        break;
      }

      case "embed": {
        const { service, source } = block.data;
        if (service === "youtube") {
          markdown += `[![YouTube Video](https://img.youtube.com/vi/${source}/0.jpg)](${source})\n\n`;
        } else {
          markdown += `${source}\n\n`;
        }
        break;
      }

      case "image": {
        const imageUrl = block.data.file?.url || block.data.url;
        const caption = block.data.caption;
        if (imageUrl) {
          if (caption && caption.trim()) {
            markdown += `![${caption}](${imageUrl})\n\n`;
          } else {
            markdown += `![](${imageUrl})\n\n`;
          }
        }
        break;
      }

      default:
        if (block.data.text) {
          markdown += `${block.data.text}\n\n`;
        }
    }
  });

  return markdown.trim();
}

export function convertMarkdownToEditorJS(markdown: string): any {
  if (!markdown || markdown.trim() === "") {
    return { blocks: [] };
  }

  const blocks: any[] = [];
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
      const level = line.match(/^#+/)?.[0].length || 1;
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
