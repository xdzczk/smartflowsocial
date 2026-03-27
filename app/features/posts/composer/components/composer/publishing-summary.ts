import type { ComposerPublishMode } from "./publish-mode";

export type ReadinessTone = "ok" | "warn" | "block";

export interface ReadinessPresentation {
  tone: ReadinessTone;
  headline: string;
}

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

export function getReadinessPresentation(
  publishMode: ComposerPublishMode,
  issues: string[],
  signerReady: boolean | null
): ReadinessPresentation {
  if (signerReady === false) {
    return { tone: "block", headline: "Signer not connected" };
  }
  if (issues.length > 0) {
    return {
      tone: "block",
      headline:
        issues.length === 1
          ? "1 issue to fix"
          : `${issues.length} issues to fix`,
    };
  }
  if (publishMode === "queue") {
    return { tone: "ok", headline: "Ready to add to queue" };
  }
  if (publishMode === "schedule") {
    return { tone: "ok", headline: "Ready to schedule" };
  }
  return { tone: "ok", headline: "Ready to publish" };
}

export function getReadinessLabel(
  publishMode: ComposerPublishMode,
  issues: string[],
  signerReady: boolean | null
): string {
  return getReadinessPresentation(publishMode, issues, signerReady).headline;
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

  const queueName =
    selectedQueue && selectedQueue !== "unassigned" ? selectedQueue : null;
  return [
    queueName ? `Queue: ${queueName}` : "Queue: Not selected",
    nextSlot
      ? `Next slot: ${nextSlot}`
      : "Timing: Set by queue when you publish",
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

/** Structured bullets for the publishing rail (replaces a single prose summary line). */
export function buildComposerContentSummaryLines(
  charCount: number,
  attachmentCount: number,
  tagsSummary: string | null | undefined,
  isRecyclable?: boolean
): string[] {
  return [
    `${charCount} characters`,
    `${attachmentCount} media`,
    tagsSummary?.trim() ? `Tags: ${tagsSummary.trim()}` : "Tags: none",
    isRecyclable ? "Recyclable: on" : "Recyclable: off",
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

export interface PublishPathSummary {
  relayCount: number;
  signerLabel: string | null;
  /** Display label for queue destination; null if none / unassigned */
  queueLabel: string | null;
}

export function buildPublishPathSummary(
  relayCount: number,
  signerLabel?: string | null,
  queueName?: string | null
): PublishPathSummary {
  return {
    relayCount,
    signerLabel: signerLabel ?? null,
    queueLabel: queueName && queueName !== "unassigned" ? queueName : null,
  };
}

export function buildPublishPathLines(
  relayCount: number,
  signerLabel?: string | null,
  queueName?: string | null
): string[] {
  const s = buildPublishPathSummary(relayCount, signerLabel, queueName);
  return [
    `${s.relayCount} relay${s.relayCount !== 1 ? "s" : ""} selected`,
    `Signer: ${s.signerLabel ?? "Not connected"}`,
    s.queueLabel ? `Queue: ${s.queueLabel}` : "Queue: none",
  ];
}

/** Human-readable local datetime for outcome / schedule copy. */
const SCHEDULE_TIME_REQUIRED = "Select a publish time to continue.";

export function formatScheduledForDisplay(isoDatetimeLocal: string): string {
  const s = isoDatetimeLocal.trim();
  if (!s) return "";
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return s;
  }
}

function tagTokenCount(tagsSummary: string | null | undefined): number {
  if (!tagsSummary?.trim()) return 0;
  return tagsSummary.trim().split(/\s+/).filter(Boolean).length;
}

function tagsAndRecyclableSuffix(
  tagsSummary: string | null | undefined,
  isRecyclable?: boolean
): string {
  const n = tagTokenCount(tagsSummary);
  const tagPart = `${n} tag${n !== 1 ? "s" : ""}`;
  return isRecyclable ? `${tagPart} · Recyclable` : tagPart;
}

/** Single-line post summary for the Post status rail row. */
export function formatPostStatusSummaryInline(
  charCount: number,
  attachmentCount: number,
  tagsSummary: string | null | undefined,
  isRecyclable?: boolean
): string {
  return `${charCount} chars · ${attachmentCount} media · ${tagsAndRecyclableSuffix(tagsSummary, isRecyclable)}`;
}

export function formatThreadPostStatusSummaryInline(
  segmentCount: number,
  totalChars: number,
  attachmentCount: number,
  tagsSummary: string | null | undefined,
  isRecyclable?: boolean
): string {
  return `${segmentCount} segments · ${totalChars} chars · ${attachmentCount} media · ${tagsAndRecyclableSuffix(tagsSummary, isRecyclable)}`;
}

export function formatPollPostStatusSummaryInline(
  questionCharCount: number,
  optionCount: number,
  tagsSummary: string | null | undefined,
  isRecyclable: boolean
): string {
  return `${questionCharCount} chars · ${optionCount} options · ${tagsAndRecyclableSuffix(tagsSummary, isRecyclable)}`;
}

export function formatArticlePostStatusSummaryInline(
  wordCount: number,
  hasCover: boolean,
  tagsSummary: string | null | undefined
): string {
  return `${wordCount} words · ${hasCover ? "cover set" : "no cover"} · ${tagsAndRecyclableSuffix(tagsSummary)}`;
}

export interface PublishingOutcomeInput {
  publishMode: ComposerPublishMode;
  relayCount: number;
  signerReady: boolean | null;
  scheduledFor: string;
  hasScheduleTime: boolean;
  selectedQueue: string;
  /** Shown for slot-based queues when client has a hint */
  queueNextSlotLabel?: string | null;
  scheduleTimeError?: string | null;
  /** Long-form (etc.) when relay count is not surfaced in the rail */
  omitRelayRequirement?: boolean;
}

export function buildPublishingOutcomeSentence(
  input: PublishingOutcomeInput
): string {
  const {
    publishMode,
    relayCount,
    signerReady,
    scheduledFor,
    hasScheduleTime,
    selectedQueue,
    queueNextSlotLabel,
    scheduleTimeError,
    omitRelayRequirement,
  } = input;

  if (publishMode === "now") {
    if (signerReady === false) return "Connect a signer to publish.";
    if (!omitRelayRequirement && relayCount <= 0) {
      return "Select at least one relay to publish.";
    }
    if (omitRelayRequirement || relayCount <= 0) {
      return "Publishes immediately after signing.";
    }
    return `Publishes immediately after signing to ${relayCount} relay${relayCount !== 1 ? "s" : ""}.`;
  }

  if (publishMode === "schedule") {
    if (!hasScheduleTime || !scheduledFor.trim()) {
      return SCHEDULE_TIME_REQUIRED;
    }
    if (scheduleTimeError) return scheduleTimeError;
    const when = formatScheduledForDisplay(scheduledFor);
    if (!when) return SCHEDULE_TIME_REQUIRED;
    const relayPart =
      relayCount > 0
        ? ` to ${relayCount} relay${relayCount !== 1 ? "s" : ""}`
        : "";
    return `Will publish on ${when}${relayPart}.`;
  }

  if (selectedQueue === "unassigned") {
    return "Choose a queue to continue.";
  }
  const q = selectedQueue;
  if (queueNextSlotLabel) {
    return `Will be added to ${q}. Next eligible slot around ${queueNextSlotLabel}.`;
  }
  return `Will be added to ${q}. Timing follows your queue rules.`;
}
