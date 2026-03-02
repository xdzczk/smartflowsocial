/**
 * Time Format Settings Component
 * Allows users to choose between 12-hour (AM/PM) and 24-hour time format
 */

import { useFetcher, useRevalidator } from "@remix-run/react";
import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

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

interface TimeFormatSettingsProps {
  timeFormat: "12h" | "24h";
}

export function TimeFormatSettings({
  timeFormat: initialTimeFormat,
}: TimeFormatSettingsProps) {
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();
  const revalidator = useRevalidator();
  const [timeFormat, setTimeFormat] = useState(initialTimeFormat);

  const isSubmitting = fetcher.state === "submitting";
  const hasChanged = timeFormat !== initialTimeFormat;

  // Revalidate root loader after successful save to update user data across the app
  useEffect(() => {
    if (fetcher.data?.success) {
      // Revalidate root loader to refresh user data (including timeFormat)
      revalidator.revalidate();
    }
  }, [fetcher.data?.success, revalidator]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("_action", "update_time_format");
    formData.append("timeFormat", timeFormat);
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <Clock className="text-foreground h-5 w-5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <CardTitle>Time Format</CardTitle>
            <CardDescription>
              Choose how time is displayed across the app (12-hour AM/PM or
              24-hour format)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="timeFormat">Time Format</Label>
            <Select
              value={timeFormat}
              onValueChange={(value) => {
                setTimeFormat(value as "12h" | "24h");
              }}
              disabled={isSubmitting}
            >
              <SelectTrigger id="timeFormat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                <SelectItem value="24h">24-hour</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || !hasChanged}
            className="w-full"
          >
            {isSubmitting ? "Saving..." : "Save Time Format"}
          </Button>

          {fetcher.data?.success ? (
            <p className="text-success text-sm">
              Time format updated successfully!
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
