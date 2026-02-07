import { useFetcher } from "@remix-run/react";
import { Plus, X } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { isAllowedScheduleInterval } from "~/lib/schedule-intervals";
import { updateScheduleIntervalsClientSchema } from "~/lib/validation";
import { useZodFieldArray } from "~/lib/validation/hooks/useZodFieldArray";
import {
  useZodForm,
  formDataToFormData,
} from "~/lib/validation/utils.client-safe";

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
  const form = useZodForm(updateScheduleIntervalsClientSchema, {
    defaultValues: {
      scheduleIntervals:
        scheduleIntervals.length > 0 ? scheduleIntervals.map(String) : [""],
    },
  });

  const { fields, append, remove } = useZodFieldArray<
    z.infer<typeof updateScheduleIntervalsClientSchema>,
    "scheduleIntervals"
  >(
    form as unknown as UseFormReturn<
      z.infer<typeof updateScheduleIntervalsClientSchema>
    >,
    "scheduleIntervals"
  );

  const isSubmitting = fetcher.state === "submitting";
  const watchedIntervals = form.watch("scheduleIntervals");
  const hasChanged =
    JSON.stringify(watchedIntervals) !==
    JSON.stringify(scheduleIntervals.map(String));

  const onSubmit = form.handleSubmit((data) => {
    // Filter out empty strings and validate
    const filteredIntervals = data.scheduleIntervals.filter(
      (interval: string) => interval.trim()
    );

    // Validate all non-empty intervals are allowed (0.25, 0.5, or whole hours)
    const invalidIntervals = filteredIntervals.filter((interval: string) => {
      const num = Number(interval.trim());
      return Number.isNaN(num) || num <= 0 || !isAllowedScheduleInterval(num);
    });

    if (invalidIntervals.length > 0) {
      form.setError("scheduleIntervals", {
        type: "manual",
        message:
          "Allowed values: 0.25 (15 min), 0.5 (30 min), or whole hours (e.g. 1, 2, 24).",
      });
      return;
    }

    const formData = formDataToFormData(
      { scheduleIntervals: filteredIntervals.join("\n") },
      "update_schedule_intervals"
    );

    fetcher.submit(formData, { method: "post" });
  });

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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit(e);
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              Add time intervals one by one (e.g. 0.25 for 15 min, 0.5 for 30
              min, 1, 2, 24). Only these values are allowed.
            </p>
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start space-x-2">
                <div className="flex-1">
                  <Input
                    type="number"
                    step="0.25"
                    min="0.25"
                    {...form.register(`scheduleIntervals.${index}`)}
                    placeholder="24"
                    disabled={isSubmitting}
                    onChange={(e) => {
                      // Remove spaces and non-numeric characters
                      const value = e.target.value.replace(/\s/g, "");
                      form.setValue(`scheduleIntervals.${index}`, value, {
                        shouldValidate: true,
                      });
                    }}
                    className={
                      form.formState.errors.scheduleIntervals?.[index]
                        ? "border-destructive"
                        : ""
                    }
                  />
                  {form.formState.errors.scheduleIntervals?.[index] ? (
                    <p className="text-destructive mt-1 text-sm">
                      {String(
                        form.formState.errors.scheduleIntervals[index].message
                      )}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={() => remove(index)}
                  disabled={isSubmitting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => append("")}
              disabled={isSubmitting}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Interval
            </Button>
          </div>

          {form.formState.errors.scheduleIntervals ? (
            <p className="text-destructive text-sm">
              {form.formState.errors.scheduleIntervals.message}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={isSubmitting || !hasChanged || !form.formState.isValid}
            className="w-full"
          >
            {isSubmitting ? "Saving..." : "Save Schedule Intervals"}
          </Button>

          {fetcher.data?.success ? (
            <p className="text-success text-sm">
              Schedule intervals updated successfully!
            </p>
          ) : null}
          {fetcher.data?.error ? (
            <p className="text-destructive text-sm">{fetcher.data.error}</p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
