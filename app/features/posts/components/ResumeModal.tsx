/**
 * Resume draft confirmation modal
 */

import { AlertTriangle } from "lucide-react";

import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { formatForDisplay, fromISOString } from "~/lib/temporal";

import type { UserData } from "../types";

interface ResumeModalProps {
  isOpen: boolean;
  selectedQueue: string;
  scheduledFor: string;
  content: string;
  caption: string;
  isSubmitting: boolean;
  user?: UserData | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function ResumeModal({
  isOpen,
  selectedQueue,
  scheduledFor,
  content,
  caption,
  isSubmitting,
  user,
  onClose,
  onConfirm,
}: ResumeModalProps) {
  const { dateLocale } = useFormattedDate();
  const userTimezone =
    user && typeof user === "object" && "timezone" in user
      ? (user.timezone ?? "UTC")
      : "UTC";

  const userTimeFormat =
    user && typeof user === "object" && "timeFormat" in user
      ? user.timeFormat === "24h"
        ? "24h"
        : "12h"
      : "12h";
  if (!isOpen) return null;

  return (
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="bg-card max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Resume Draft</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-muted-foreground dark:text-foreground dark:hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="dark:bg-muted rounded-lg bg-yellow-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle
                  className="h-5 w-5 text-yellow-400"
                  strokeWidth={INLINE_ICON_STROKE}
                  aria-hidden
                />
              </div>
              <div className="ml-3">
                <h3 className="dark:text-foreground text-sm font-medium text-yellow-800">
                  Signing Required
                </h3>
                <div className="dark:text-foreground mt-2 text-sm text-yellow-700">
                  <p>
                    This draft needs to be signed before it can be scheduled.
                    The signing process will create a cryptographic signature
                    required for posting.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p>
              <strong>Queue:</strong> {selectedQueue}
            </p>
            <p>
              <strong>Scheduled for:</strong>{" "}
              {(() => {
                try {
                  const zoned = fromISOString(scheduledFor, "UTC");
                  const userZoned = zoned.withTimeZone(userTimezone);
                  return formatForDisplay(
                    userZoned,
                    userTimezone,
                    {
                      month: "2-digit",
                      day: "2-digit",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: userTimeFormat === "12h",
                    },
                    userTimeFormat,
                    dateLocale
                  );
                } catch {
                  return scheduledFor;
                }
              })()}
            </p>
            <p>
              <strong>Content:</strong> {(content || caption).substring(0, 100)}
              ...
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="bg-card border-border text-muted-foreground hover:bg-muted rounded-lg border px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isSubmitting}
              className="bg-success hover:bg-success/90 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isSubmitting ? "Signing & Scheduling..." : "Sign & Schedule"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
