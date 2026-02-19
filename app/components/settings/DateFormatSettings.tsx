/**
 * Date Format Settings Component
 * Allows users to choose display format: DD/MM/YYYY, MM/DD/YYYY, or YYYY-MM-DD
 */

import { useFetcher, useRevalidator } from "@remix-run/react";
import { Calendar } from "lucide-react";
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

export type DateFormatKey = "ddmmyyyy" | "mmddyyyy" | "yyyymmdd";

interface DateFormatSettingsProps {
  dateFormat: DateFormatKey;
}

export function DateFormatSettings({
  dateFormat: initialDateFormat,
}: DateFormatSettingsProps) {
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();
  const revalidator = useRevalidator();
  const [dateFormat, setDateFormat] =
    useState<DateFormatKey>(initialDateFormat);

  const isSubmitting = fetcher.state === "submitting";
  const hasChanged = dateFormat !== initialDateFormat;

  useEffect(() => {
    if (fetcher.data?.success) {
      revalidator.revalidate();
    }
  }, [fetcher.data?.success, revalidator]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("_action", "update_date_format");
    formData.append("dateFormat", dateFormat);
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-4">
          <Calendar className="text-foreground h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <CardTitle>Date Format</CardTitle>
            <CardDescription>
              Choose how dates are displayed across the app
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dateFormat">Date Format</Label>
            <Select
              value={dateFormat}
              onValueChange={(value) => {
                setDateFormat(value as DateFormatKey);
              }}
              disabled={isSubmitting}
            >
              <SelectTrigger id="dateFormat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ddmmyyyy">
                  DD/MM/YYYY (e.g. 19/02/2025)
                </SelectItem>
                <SelectItem value="mmddyyyy">
                  MM/DD/YYYY (e.g. 02/19/2025)
                </SelectItem>
                <SelectItem value="yyyymmdd">
                  YYYY-MM-DD (e.g. 2025-02-19)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || !hasChanged}
            className="w-full"
          >
            {isSubmitting ? "Saving..." : "Save Date Format"}
          </Button>

          {fetcher.data?.success ? (
            <p className="text-success text-sm">
              Date format updated successfully!
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
