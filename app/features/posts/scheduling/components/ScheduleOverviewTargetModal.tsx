import { useFetcher } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";

export interface ScheduleOverviewTargetModalProps {
  open: boolean;
  onClose: () => void;
  targetPerDay: number;
  onSuccess?: () => void;
}

const MIN_TARGET = 0;
const MAX_TARGET = 10;

export function ScheduleOverviewTargetModal({
  open,
  onClose,
  targetPerDay,
  onSuccess,
}: ScheduleOverviewTargetModalProps) {
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();
  const [value, setValue] = useState(targetPerDay);
  const prevFetcherStateRef = useRef(fetcher.state);
  const didSubmitRef = useRef(false);

  useEffect(() => {
    const prevState = prevFetcherStateRef.current;
    prevFetcherStateRef.current = fetcher.state;
    const justFinishedSubmit =
      (prevState === "submitting" || prevState === "loading") &&
      fetcher.state === "idle";
    const canClose =
      fetcher.state === "idle" &&
      fetcher.data?.success &&
      (justFinishedSubmit || didSubmitRef.current);
    if (canClose) {
      didSubmitRef.current = false;
      onClose();
      onSuccess?.();
    }
  }, [fetcher.state, fetcher.data, onSuccess, onClose]);

  const handleSave = () => {
    didSubmitRef.current = true;
    const formData = new FormData();
    formData.set("_action", "updateScheduleOverviewTarget");
    formData.set("targetPostsPerDay", String(value));
    fetcher.submit(formData, { method: "post" });
  };

  const isSubmitting = fetcher.state !== "idle";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Schedule overview</DialogTitle>
          <DialogDescription>
            Set your target posts per day. Days with fewer scheduled posts will
            be highlighted as gaps. Set to 0 to turn off gap highlighting.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {fetcher.data?.error ? (
            <p className="text-danger text-sm" role="alert">
              {fetcher.data.error}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label
              htmlFor="schedule-overview-target"
              className="text-sm font-medium"
            >
              Target posts per day
            </Label>
            <select
              id="schedule-overview-target"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              className="border-border bg-canvas ring-offset-canvas focus-visible:ring-focus-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              aria-describedby="schedule-overview-target-hint"
            >
              {Array.from({ length: MAX_TARGET - MIN_TARGET + 1 }, (_, i) => {
                const n = MIN_TARGET + i;
                return (
                  <option key={n} value={n}>
                    {n === 0 ? "0 (off)" : String(n)}
                  </option>
                );
              })}
            </select>
            <p
              id="schedule-overview-target-hint"
              className="text-text-secondary text-xs"
            >
              {value === 0
                ? "Gap highlighting is off."
                : "Days with fewer scheduled posts will show as gaps."}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
