import type { ComposerPublishMode } from "./publish-mode";

interface BuildCommonSectionsInput {
  publishMode: ComposerPublishMode;
  relayCount: number;
  signerLabel?: string | null;
  scheduledFor?: string | null;
  timezone?: string;
  selectedQueue?: string;
  nextSlot?: string;
  randomizationLabel?: string;
}

export function getReadinessLabel(
  publishMode: ComposerPublishMode,
  issues: string[],
  signerReady: boolean | null
): string {
  if (signerReady === false) return "Waiting for signer connection";
  if (issues.length > 0) return `Needs attention (${issues.length})`;
  if (publishMode === "queue") return "Ready to add to queue";
  if (publishMode === "schedule") return "Ready to schedule";
  return "Ready to publish";
}

export function buildDeliveryLines({
  publishMode,
  relayCount,
  signerLabel,
  scheduledFor,
  timezone,
  selectedQueue,
  nextSlot,
  randomizationLabel,
}: BuildCommonSectionsInput): string[] {
  if (publishMode === "now") {
    return [
      "Mode: Publish now",
      `${relayCount} relay${relayCount !== 1 ? "s" : ""} selected`,
      `Signer: ${signerLabel ?? "Not connected"}`,
    ];
  }

  if (publishMode === "schedule") {
    return [
      `Scheduled for: ${scheduledFor?.trim() ? scheduledFor : "Not set"}`,
      `Timezone: ${timezone ?? "UTC"}`,
      `Randomization: ${randomizationLabel ?? "Off"}`,
      selectedQueue && selectedQueue !== "unassigned"
        ? `Optional queue: ${selectedQueue}`
        : "Optional queue: None",
    ];
  }

  return [
    `Queue: ${selectedQueue && selectedQueue !== "unassigned" ? selectedQueue : "Not selected"}`,
    `Next slot: ${nextSlot ?? "Not available"}`,
    `Timing behavior: ${randomizationLabel ?? "Fixed slot behavior"}`,
  ];
}

export function buildPostContentLines(
  charCount: number,
  attachmentCount: number,
  tagsSummary?: string | null
): string[] {
  return [
    `${charCount} chars · ${attachmentCount} attachments · ${
      tagsSummary?.trim() ? tagsSummary.trim() : "no tags"
    }`,
  ];
}

export function buildThreadContentLines(
  segmentCount: number,
  totalChars: number,
  attachmentCount: number,
  cadenceMinutes: number
): string[] {
  const estimatedTotal = Math.max(segmentCount - 1, 0) * cadenceMinutes;
  return [
    `${segmentCount} segments · ${totalChars} chars · ${attachmentCount} attachments · cadence ${cadenceMinutes}m · est ${estimatedTotal}m`,
  ];
}

export function buildPollContentLines(
  questionLength: number,
  optionCount: number,
  tagsSummary?: string | null
): string[] {
  return [
    `${questionLength} chars · ${optionCount} options · ${
      tagsSummary?.trim() ? tagsSummary.trim() : "no tags"
    }`,
  ];
}

export function buildArticleContentLines(
  hasTitle: boolean,
  wordCount: number,
  hasCover: boolean,
  assetCount: number
): string[] {
  return [
    `${hasTitle ? "title set" : "title missing"} · ${wordCount} words · ${
      hasCover ? "cover set" : "cover missing"
    } · ${assetCount} assets`,
  ];
}

export function buildPublishPathLines(
  relayCount: number,
  signerLabel?: string | null,
  queueName?: string | null
): string[] {
  return [
    `${relayCount} relay${relayCount !== 1 ? "s" : ""} selected`,
    `Signer: ${signerLabel ?? "Not connected"}`,
    queueName && queueName !== "unassigned"
      ? `Queue destination: ${queueName}`
      : "Queue destination: N/A",
  ];
}
