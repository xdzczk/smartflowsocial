/**
 * Date Format Settings — regional date ordering.
 */

import { useFetcher, useRevalidator } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { PreferenceSection } from "~/features/settings/components/patterns";

export type DateFormatKey = "ddmmyyyy" | "mmddyyyy" | "yyyymmdd";

interface DateFormatSettingsProps {
  dateFormat: DateFormatKey;
}

export function DateFormatSettings({
  dateFormat: initialDateFormat,
}: DateFormatSettingsProps) {
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();
  const revalidator = useRevalidator();
  const prevFetcherState = useRef(fetcher.state);
  const [dateFormat, setDateFormat] =
    useState<DateFormatKey>(initialDateFormat);

  useEffect(() => {
    setDateFormat(initialDateFormat);
  }, [initialDateFormat]);

  const isSubmitting = fetcher.state === "submitting";

  useEffect(() => {
    if (
      prevFetcherState.current === "submitting" &&
      fetcher.state === "idle" &&
      fetcher.data?.success
    ) {
      toast.success("Date format saved");
      revalidator.revalidate();
    }
    if (
      prevFetcherState.current === "submitting" &&
      fetcher.state === "idle" &&
      fetcher.data?.error
    ) {
      toast.error(fetcher.data.error);
    }
    prevFetcherState.current = fetcher.state;
  }, [fetcher.state, fetcher.data, revalidator]);

  const persist = (value: DateFormatKey) => {
    if (value === initialDateFormat) return;
    const formData = new FormData();
    formData.append("_action", "update_date_format");
    formData.append("dateFormat", value);
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <PreferenceSection
      title="Date format"
      description="How dates appear in lists and previews."
    >
      <div className="space-y-2">
        <Label htmlFor="dateFormat">Format</Label>
        <Select
          value={dateFormat}
          onValueChange={(value) => {
            const v = value as DateFormatKey;
            setDateFormat(v);
            persist(v);
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
    </PreferenceSection>
  );
}
