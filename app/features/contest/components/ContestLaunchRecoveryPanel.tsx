import { Form, Link, useSubmit } from "@remix-run/react";
import { useMemo, useState } from "react";

import { Button } from "~/components/ui/button";

import type { ContestDetailPageData } from "../contest-detail.types";

type Orch = NonNullable<ContestDetailPageData["launchOrchestration"]>;

function toDateTimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ContestLaunchRecoveryPanel({
  contestStatus,
  launchOrchestration,
}: {
  contestStatus: string;
  launchOrchestration: Orch | null;
}) {
  const [rescheduleValue, setRescheduleValue] = useState("");
  const submit = useSubmit();

  function submitReschedule(form: HTMLFormElement) {
    const fd = new FormData(form);
    const local = String(fd.get("scheduledFor") ?? "").trim();
    if (!local) return;
    const d = new Date(local);
    if (!Number.isFinite(d.getTime())) return;
    fd.set("scheduledFor", d.toISOString());
    submit(fd, { method: "post" });
  }

  const scheduledLabel = useMemo(() => {
    const iso = launchOrchestration?.scheduledFor;
    if (!iso) return null;
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return null;
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }, [launchOrchestration?.scheduledFor]);

  if (!launchOrchestration || contestStatus === "LIVE") return null;

  const failedActivation =
    launchOrchestration.contestActivationStatus === "failed" ||
    launchOrchestration.contestActivationStatus === "blocked_by_source_failure";
  const failedPublish =
    launchOrchestration.sourcePostPublishStatus === "failed";
  const isFailure = failedActivation || failedPublish;

  const canReschedule =
    contestStatus === "SCHEDULED_LAUNCH" &&
    launchOrchestration.launchMode === "schedule" &&
    Boolean(launchOrchestration.scheduledFor);

  const showScheduledInfo =
    contestStatus === "SCHEDULED_LAUNCH" &&
    launchOrchestration.contestActivationStatus === "scheduled" &&
    !isFailure;

  return (
    <div className="space-y-3">
      {showScheduledInfo && scheduledLabel ? (
        <div className="border-border bg-surface-hover/30 rounded-md border p-3 text-sm">
          <p className="text-text font-medium">Scheduled contest launch</p>
          <p className="text-text-secondary">
            Activates at {scheduledLabel}
            {launchOrchestration.sourceMode === "new_post"
              ? " (after the linked post publishes, when applicable)."
              : "."}
          </p>
        </div>
      ) : null}

      {isFailure ? (
        <div className="border-danger/40 bg-danger/10 text-danger rounded-md border p-3 text-sm">
          <p className="font-medium">Launch issue</p>
          <p className="mb-3">
            {launchOrchestration.lastErrorMessage ??
              "Something went wrong with the scheduled launch. You can retry, reschedule, or cancel."}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Form method="post">
              <input
                type="hidden"
                name="intent"
                value="retryLaunchOrchestration"
              />
              <Button type="submit" size="sm" variant="secondary">
                Retry launch
              </Button>
            </Form>
            {canReschedule ? (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitReschedule(e.currentTarget);
                }}
              >
                <input type="hidden" name="intent" value="rescheduleLaunch" />
                <label className="text-text flex flex-col gap-1 text-xs">
                  New time
                  <input
                    name="scheduledFor"
                    type="datetime-local"
                    required
                    className="border-border bg-canvas text-text rounded-xs border px-2 py-1"
                    value={
                      rescheduleValue ||
                      toDateTimeLocalValue(launchOrchestration.scheduledFor)
                    }
                    onChange={(e) => setRescheduleValue(e.target.value)}
                  />
                </label>
                <Button type="submit" size="sm" variant="outline">
                  Reschedule
                </Button>
              </form>
            ) : null}
            <Form method="post">
              <input type="hidden" name="intent" value="cancel" />
              <input
                type="hidden"
                name="reason"
                value="Cancel scheduled launch from recovery panel"
              />
              <Button type="submit" size="sm" variant="ghost">
                Cancel contest
              </Button>
            </Form>
          </div>
          {launchOrchestration.sourcePostId ? (
            <p className="text-text-secondary mt-3 text-xs">
              If the source post publish failed, fix or reschedule it from{" "}
              <Link
                to="/dashboard/scheduled"
                className="text-brand underline-offset-2 hover:underline"
              >
                Scheduled
              </Link>
              .
            </p>
          ) : null}
        </div>
      ) : null}

      {!isFailure && canReschedule ? (
        <div className="border-border rounded-md border p-3 text-sm">
          <p className="text-text mb-2 font-medium">Change launch time</p>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitReschedule(e.currentTarget);
            }}
          >
            <input type="hidden" name="intent" value="rescheduleLaunch" />
            <label
              htmlFor="contest-recovery-reschedule-time"
              className="text-text flex flex-col gap-1 text-xs"
            >
              <span>New launch time</span>
              <input
                id="contest-recovery-reschedule-time"
                name="scheduledFor"
                type="datetime-local"
                required
                className="border-border bg-canvas text-text rounded-xs border px-2 py-1"
                defaultValue={toDateTimeLocalValue(
                  launchOrchestration.scheduledFor
                )}
              />
            </label>
            <Button type="submit" size="sm" variant="outline">
              Reschedule launch
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
