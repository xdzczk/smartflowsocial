import { useFetcher } from "@remix-run/react";
import { useState } from "react";

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

interface TimezoneSettingsProps {
  timezone: string | null;
}

interface FetcherData {
  success?: boolean;
  error?: string;
}

export function TimezoneSettings({ timezone }: TimezoneSettingsProps) {
  const fetcher = useFetcher<FetcherData>();
  const [selectedTimezone, setSelectedTimezone] = useState(
    timezone ?? "Etc/UTC",
  );

  const isSubmitting = fetcher.state === "submitting";
  const hasChanged = selectedTimezone !== timezone;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.set("_action", "update_timezone");
    formData.set("timezone", selectedTimezone);
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timezone</CardTitle>
        <CardDescription>
          Set your timezone for scheduling posts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="timezone">Select Timezone</Label>
            <Select
              value={selectedTimezone}
              onValueChange={setSelectedTimezone}
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
