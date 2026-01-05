import { useFetcher } from "@remix-run/react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { timeZonesList } from "~/lib/date";
import { updateTimezoneClientSchema } from "~/lib/validation";
import { useZodForm, formDataToFormData } from "~/lib/validation/utils.client-safe";

interface TimezoneSettingsProps {
  timezone: string | null;
}

interface FetcherData {
  success?: boolean;
  error?: string;
}

export function TimezoneSettings({ timezone }: TimezoneSettingsProps) {
  const fetcher = useFetcher<FetcherData>();
  const form = useZodForm(updateTimezoneClientSchema, {
    defaultValues: {
      timezone: timezone ?? "Etc/UTC",
    },
  });

  const isSubmitting = fetcher.state === "submitting";
  const hasChanged = form.watch("timezone") !== timezone;

  const onSubmit = form.handleSubmit((data) => {
    const formData = formDataToFormData(data, "update_timezone");
    fetcher.submit(formData, { method: "post" });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timezone</CardTitle>
        <CardDescription>
          Set your timezone for scheduling posts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); void onSubmit(e); }} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="timezone">Select Timezone</Label>
            <Select
              value={form.watch("timezone")}
              onValueChange={(value) => {
                form.setValue("timezone", value, { shouldValidate: true });
              }}
              disabled={isSubmitting}
            >
              <SelectTrigger id="timezone">
                <SelectValue placeholder="Select a timezone" />
              </SelectTrigger>
              <SelectContent>
                {timeZonesList.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.timezone ? <p className="text-sm text-destructive">
                {form.formState.errors.timezone.message}
              </p> : null}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || !hasChanged}
            className="w-full"
          >
            {isSubmitting ? "Saving..." : "Save Timezone"}
          </Button>

          {fetcher.data?.success ? (
            <p className="text-sm text-green-600">
              Timezone updated successfully!
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
