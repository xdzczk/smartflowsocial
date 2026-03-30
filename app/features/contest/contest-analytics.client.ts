/** Lightweight contest creation analytics (spec §12); mirrors composer CustomEvent pattern. */
export function trackContestCreationEvent(
  event:
    | "contest_draft_saved"
    | "contest_launch_submit"
    | "contest_source_mode"
    | "contest_launch_mode"
    | "contest_schedule_set"
    | "contest_publish_success"
    | "contest_publish_fail"
    | "contest_activation_success"
    | "contest_activation_fail"
    | "contest_launch_retry"
    | "contest_launch_reschedule",
  payload?: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent("smartflow:contest-analytics", {
        detail: { name: event, payload: payload ?? {}, at: Date.now() },
      })
    );
  } catch {
    // ignore
  }
}
