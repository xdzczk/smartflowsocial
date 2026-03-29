import type { ComposerPublishMode } from "../components/composer/publish-mode";
import { formatRecyclableMetaLine } from "../components/composer/publishing-summary";

export function buildPostThreadPreviewMetaLines(input: {
  publishMode: ComposerPublishMode;
  relayCount: number;
  selectedQueue: string;
  followUpSummaryLine: string;
  isRecyclable: boolean;
  /** Optional first line detail (e.g. scheduled local string). */
  scheduleHint?: string | null;
}): string[] {
  const lines: string[] = [];
  lines.push(
    `Delivery: ${input.relayCount} relay${input.relayCount !== 1 ? "s" : ""}`
  );
  if (input.publishMode === "schedule" && input.scheduleHint?.trim()) {
    lines.push(`Publish: ${input.scheduleHint.trim()}`);
  }
  if (input.publishMode === "queue") {
    lines.push(
      `Queue: ${input.selectedQueue !== "unassigned" ? input.selectedQueue : "Not selected"}`
    );
  }
  lines.push(`Follow-up: ${input.followUpSummaryLine.trim() || "None"}`);
  lines.push(formatRecyclableMetaLine(input.isRecyclable));
  return lines;
}
