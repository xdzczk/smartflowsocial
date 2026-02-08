/**
 * Client-only: convert pasted HTML to markdown for Tiptap paste handling.
 * Uses turndown; loaded lazily so it only runs in browser on paste.
 */

/** Minimal type for Turndown instance (no @types/turndown). */
interface TurndownInstance {
  turndown(html: string): string;
}

interface TurndownModule {
  default: new (opts?: {
    headingStyle?: string;
    codeBlockStyle?: string;
  }) => TurndownInstance;
}

let turndownService: TurndownInstance | null = null;

async function getTurndownService(): Promise<TurndownInstance> {
  if (turndownService) return turndownService;
  const mod = (await import("turndown")) as TurndownModule;
  const Service = mod.default;
  turndownService = new Service({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });
  return turndownService;
}

/**
 * Converts HTML string to markdown. Returns plain text if conversion fails.
 */
export async function htmlToMarkdown(html: string): Promise<string> {
  if (!html || typeof html !== "string") return "";
  const trimmed = html.trim();
  if (!trimmed) return "";
  try {
    const service = await getTurndownService();
    return service.turndown(trimmed);
  } catch {
    return trimmed.replace(/<[^>]*>/g, "").trim();
  }
}
