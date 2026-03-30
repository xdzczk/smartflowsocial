import type { ComposerPublishMode } from "../composer";
import { MIN_THREAD_SEGMENTS } from "../composer/thread-constants";

export interface UnifiedComposerIssueListParams {
  isTemplateMode: boolean;
  canSubmit: boolean;
  signerReady: boolean | null;
  embedContext: "contest" | undefined;
  contestSubmitMode: ComposerPublishMode;
  publishMode: ComposerPublishMode;
  hasScheduleTimeForSubmit: boolean;
  selectedQueue: string;
  isThreadMode: boolean;
  threadSegmentsLength: number;
  hasContent: boolean;
  relayCount: number;
  content: string;
  threadSegments: Array<{ content: string; attachments: unknown[] }>;
  attachmentsLength: number;
}

export function buildUnifiedComposerHardAndDeferrableBlockers(
  p: UnifiedComposerIssueListParams
): { hardBlockers: string[]; deferrableBlockers: string[] } {
  const hardBlockers: string[] = [];
  const deferrableBlockers: string[] = [];

  if (p.isTemplateMode) {
    if (!p.canSubmit) {
      hardBlockers.push(
        "Resolve media upload issues before saving the template."
      );
    }
  } else {
    if (p.signerReady === false) {
      hardBlockers.push("Signer not connected");
    }
    if (!p.canSubmit) {
      deferrableBlockers.push("Resolve media upload issues before publishing");
    }
    if (
      (p.embedContext === "contest" ? p.contestSubmitMode : p.publishMode) ===
        "schedule" &&
      !p.hasScheduleTimeForSubmit
    ) {
      deferrableBlockers.push("Publish time is required");
    }
    if (p.publishMode === "queue" && p.selectedQueue === "unassigned") {
      deferrableBlockers.push("Choose a queue");
    }
    if (p.isThreadMode && p.threadSegmentsLength < MIN_THREAD_SEGMENTS) {
      deferrableBlockers.push(
        "Threads need at least two segments. Add another below the first."
      );
    }
    if (!p.hasContent) {
      deferrableBlockers.push(
        p.isThreadMode
          ? "Each thread segment needs text or at least one media item."
          : "Add text or at least one media item."
      );
    }
    if (p.relayCount <= 0) {
      deferrableBlockers.push("Select at least one relay.");
    }
  }

  return { hardBlockers, deferrableBlockers };
}

export function buildUnifiedComposerTemplateRailWarnings(p: {
  isTemplateMode: boolean;
  isThreadMode: boolean;
  threadSegments: Array<{ content: string; attachments: unknown[] }>;
  content: string;
  attachmentsLength: number;
}): string[] {
  const templateRailWarnings: string[] = [];
  if (!p.isTemplateMode) return templateRailWarnings;

  if (p.isThreadMode) {
    if (p.threadSegments.length < MIN_THREAD_SEGMENTS) {
      templateRailWarnings.push(
        "Thread templates usually need at least two segments."
      );
    }
    if (
      p.threadSegments.some(
        (s) => s.content.trim() === "" && s.attachments.length === 0
      )
    ) {
      templateRailWarnings.push("Some thread segments are still empty.");
    }
  } else if (p.content.trim() === "" && p.attachmentsLength === 0) {
    templateRailWarnings.push(
      "Template body is empty — you can still save a starter blueprint."
    );
  }

  return templateRailWarnings;
}
