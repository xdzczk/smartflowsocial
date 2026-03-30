import { logError } from "./error-logger.server";
import {
  extractPlainText,
  generateSummary,
  sanitizeMarkdown as sanitizeMarkdownCore,
} from "./markdown-sanitize";

/**
 * Server-side markdown sanitization with error logging.
 * @see sanitizeMarkdown in ./markdown-sanitize.ts for browser-safe usage.
 */
export function sanitizeMarkdown(markdown: string): string {
  return sanitizeMarkdownCore(markdown, {
    onError: (error) => {
      logError(error instanceof Error ? error : new Error(String(error)), {
        message: "Error sanitizing markdown",
      });
    },
  });
}

export { extractPlainText, generateSummary };
