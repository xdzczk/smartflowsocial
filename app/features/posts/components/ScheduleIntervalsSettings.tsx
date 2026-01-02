import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";

import { DynamicInputList } from "~/components/settings/DynamicInputList";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

interface ScheduleIntervalsSettingsProps {
  scheduleIntervals: string[];
}

interface FetcherData {
  success?: boolean;
  error?: string;
}

export function ScheduleIntervalsSettings({
  scheduleIntervals,
}: ScheduleIntervalsSettingsProps) {
  const fetcher = useFetcher<FetcherData>();
  const [intervalsState, setIntervalsState] = useState(
    scheduleIntervals ? scheduleIntervals.map(String) : [],
  );

  const isSubmitting = fetcher.state === "submitting";
  const hasChanged =
    JSON.stringify(intervalsState) !==
    JSON.stringify((scheduleIntervals || []).map(String));

  useEffect(() => {
    if (scheduleIntervals) {
      setIntervalsState(scheduleIntervals.map(String));
    }
  }, [scheduleIntervals]);

  const validateInterval = (interval: string) => {
    const num = parseInt(interval, 10);
    return !isNaN(num) && num > 0 && num.toString() === interval.trim();
  };

  const hasValidationErrors = intervalsState.some(
    (interval) => interval.trim() && !validateInterval(interval.trim()),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const intervals = intervalsState.filter((interval) => interval.trim());
    const formData = new FormData();
    formData.set("_action", "update_schedule_intervals");
    formData.set("scheduleIntervals", intervals.join("\n"));
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule Intervals (hours)</CardTitle>
        <CardDescription>
          Set time intervals for posting. These will be used by queue types that
          use global intervals.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DynamicInputList
            items={intervalsState}
            setItems={setIntervalsState}
            placeholder="24"
            validate={validateInterval}
            disabled={isSubmitting}
            inputType="number"
            preventSpaces={true}
            description="Add time intervals one by one (whole numbers only, e.g. 1 for 1 hour, 24 for 24 hours)"
          />

          <Button
            type="submit"
            disabled={isSubmitting || !hasChanged || hasValidationErrors}
            className="w-full"
          >
            {isSubmitting ? "Saving..." : "Save Schedule Intervals"}
          </Button>

          {fetcher.data?.success ? (
            <p className="text-sm text-green-600">
              Schedule intervals updated successfully!
            </p>
          ) : null}
          {fetcher.data?.error ? (
            <p className="text-sm text-destructive">{fetcher.data.error}</p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
