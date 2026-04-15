import { useEffect, useState } from "react";

interface UseScheduleOverlapWarningOptions {
  scheduledFor: string | null | undefined;
  queueTypeId?: string | null;
  enabled?: boolean;
  excludeContentId?: string | null;
}

interface ScheduleOverlapWarningResponse {
  warning?: {
    message?: unknown;
  } | null;
}

export function useScheduleOverlapWarning({
  scheduledFor,
  queueTypeId,
  enabled = true,
  excludeContentId,
}: UseScheduleOverlapWarningOptions) {
  const [remoteWarning, setRemoteWarning] = useState<string | null>(null);
  const trimmed = (scheduledFor ?? "").trim();
  const shouldCheck = enabled && trimmed.length > 0;

  useEffect(() => {
    if (!shouldCheck) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          setRemoteWarning(null);
          const response = await fetch("/api/schedule-overlap-warning", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              scheduledFor: trimmed,
              queueTypeId: queueTypeId ?? null,
              excludeContentId: excludeContentId ?? null,
            }),
          });
          if (!response.ok) {
            setRemoteWarning(null);
            return;
          }

          const data =
            (await response.json()) as ScheduleOverlapWarningResponse;
          const message = data.warning?.message;
          setRemoteWarning(
            typeof message === "string" && message.trim() ? message : null
          );
        } catch (error) {
          const isAbortError =
            error instanceof DOMException && error.name === "AbortError";
          if (!isAbortError) {
            setRemoteWarning(null);
          }
        }
      })();
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [shouldCheck, trimmed, queueTypeId, excludeContentId]);

  return { warning: shouldCheck ? remoteWarning : null };
}
