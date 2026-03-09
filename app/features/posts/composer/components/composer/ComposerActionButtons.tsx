/**
 * Composer action buttons: Post/Schedule, Save as Draft, or template save/cancel.
 */

import { Link } from "@remix-run/react";
import { Clock, Pencil, Send } from "lucide-react";
import React from "react";

import { Button } from "~/components/ui/button";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";

import {
  ACTION_POST_TEXT,
  ACTION_SCHEDULE_TEXT,
} from "./composer-submit-utils";

function getPrimaryLabel(
  isSigning: boolean,
  fetcherState: string,
  hasScheduleTimeForSubmit: boolean,
  scheduleTimeLabel: string | null,
  isThreadMode: boolean
): string {
  if (isSigning) return "Waiting for signer…";
  if (fetcherState !== "idle") {
    if (hasScheduleTimeForSubmit)
      return isThreadMode ? "Scheduling thread…" : "Scheduling...";
    return isThreadMode ? "Posting thread…" : "Posting...";
  }
  if (hasScheduleTimeForSubmit) {
    if (scheduleTimeLabel)
      return isThreadMode
        ? `Schedule thread for ${scheduleTimeLabel}`
        : `Schedule for ${scheduleTimeLabel}`;
    return isThreadMode ? "Schedule thread" : "Schedule";
  }
  return isThreadMode ? "Post thread" : "Post Now";
}

export interface ComposerActionButtonsProps {
  isTemplateMode: boolean;
  primarySubmitRef: React.RefObject<HTMLButtonElement | null>;
  draftSubmitRef: React.RefObject<HTMLButtonElement | null>;
  disabled: boolean;
  signerReady: boolean | null;
  hasScheduleTimeForSubmit: boolean;
  scheduleTimeLabel: string | null;
  isThreadMode: boolean;
  segmentCount: number;
  threadDelayMinutes: number;
  isSigning: boolean;
  fetcherState: string;
  templateName: string;
  editTemplateContext: { templateId: string; postId: string } | null;
}

export function ComposerActionButtons({
  isTemplateMode,
  primarySubmitRef,
  draftSubmitRef,
  disabled,
  signerReady,
  hasScheduleTimeForSubmit,
  scheduleTimeLabel,
  isThreadMode,
  segmentCount: _segmentCount,
  threadDelayMinutes: _threadDelayMinutes,
  isSigning,
  fetcherState,
  templateName,
  editTemplateContext,
}: ComposerActionButtonsProps) {
  const primaryLabel = getPrimaryLabel(
    isSigning,
    fetcherState,
    hasScheduleTimeForSubmit,
    scheduleTimeLabel,
    isThreadMode
  );

  if (isTemplateMode) {
    return (
      <>
        <Button
          ref={primarySubmitRef}
          type="submit"
          value="save-as-template"
          name="_action"
          disabled={disabled || !templateName.trim()}
        >
          {fetcherState !== "idle"
            ? "Saving..."
            : editTemplateContext
              ? "Save"
              : "Save as template"}
        </Button>
        <Button type="button" variant="ghost" asChild>
          <Link to="/dashboard/templates">Cancel</Link>
        </Button>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {signerReady === false ? (
        <Button variant="default" asChild>
          <Link to="/dashboard/settings">Connect signer</Link>
        </Button>
      ) : (
        <Button
          ref={primarySubmitRef}
          type="submit"
          value={
            hasScheduleTimeForSubmit ? ACTION_SCHEDULE_TEXT : ACTION_POST_TEXT
          }
          name="_action"
          className="bg-success hover:bg-success/90 text-white"
          disabled={disabled}
        >
          {hasScheduleTimeForSubmit ? (
            <Clock
              className="mr-1.5 h-5 w-5"
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          ) : (
            <Send
              className="mr-1.5 h-5 w-5"
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          )}
          {primaryLabel}
        </Button>
      )}
      <Button
        ref={draftSubmitRef}
        type="submit"
        value="draft-text"
        name="_action"
        variant="outline"
        disabled={disabled}
      >
        <Pencil
          className="mr-1.5 h-5 w-5"
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
        {fetcherState !== "idle" ? "Saving..." : "Save as Draft"}
      </Button>
    </div>
  );
}
