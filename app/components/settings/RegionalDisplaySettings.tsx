/**
 * Regional & display — timezone, 12/24h time, and date ordering in one section.
 */

import { useFetcher, useRevalidator } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { SearchableTimezoneSelector } from "~/components/settings/SearchableTimezoneSelector";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { PreferenceSection } from "~/features/settings/components/patterns";
import { BRAND_NAME } from "~/lib/brand";
import { updateTimezoneClientSchema } from "~/lib/validation";
import {
  useZodForm,
  formDataToFormData,
} from "~/lib/validation/utils.client-safe";

export type DateFormatKey = "ddmmyyyy" | "mmddyyyy" | "yyyymmdd";

interface RegionalDisplaySettingsProps {
  timezone: string | null;
  timeFormat: "12h" | "24h";
  dateFormat: DateFormatKey;
}

interface FetcherSuccess {
  success?: boolean;
  error?: string;
}

export function RegionalDisplaySettings({
  timezone,
  timeFormat: initialTimeFormat,
  dateFormat: initialDateFormat,
}: RegionalDisplaySettingsProps) {
  const revalidator = useRevalidator();

  const timezoneFetcher = useFetcher<FetcherSuccess>();
  const timeFormatFetcher = useFetcher<FetcherSuccess>();
  const dateFormatFetcher = useFetcher<FetcherSuccess>();

  const prevTz = useRef(timezoneFetcher.state);
  const prevTf = useRef(timeFormatFetcher.state);
  const prevDf = useRef(dateFormatFetcher.state);

  const tzForm = useZodForm(updateTimezoneClientSchema, {
    defaultValues: { timezone: timezone ?? "Etc/UTC" },
  });

  const [timeFormat, setTimeFormat] = useState(initialTimeFormat);
  const [dateFormat, setDateFormat] =
    useState<DateFormatKey>(initialDateFormat);

  useEffect(() => {
    tzForm.reset({ timezone: timezone ?? "Etc/UTC" });
  }, [timezone, tzForm]);

  useEffect(() => {
    setTimeFormat(initialTimeFormat);
  }, [initialTimeFormat]);

  useEffect(() => {
    setDateFormat(initialDateFormat);
  }, [initialDateFormat]);

  useEffect(() => {
    if (
      prevTz.current === "submitting" &&
      timezoneFetcher.state === "idle" &&
      timezoneFetcher.data?.success
    ) {
      toast.success("Timezone saved");
      revalidator.revalidate();
    }
    if (
      prevTz.current === "submitting" &&
      timezoneFetcher.state === "idle" &&
      timezoneFetcher.data?.error
    ) {
      toast.error(timezoneFetcher.data.error);
    }
    prevTz.current = timezoneFetcher.state;
  }, [timezoneFetcher.state, timezoneFetcher.data, revalidator]);

  useEffect(() => {
    if (
      prevTf.current === "submitting" &&
      timeFormatFetcher.state === "idle" &&
      timeFormatFetcher.data?.success
    ) {
      toast.success("Time format saved");
      revalidator.revalidate();
    }
    if (
      prevTf.current === "submitting" &&
      timeFormatFetcher.state === "idle" &&
      timeFormatFetcher.data?.error
    ) {
      toast.error(timeFormatFetcher.data.error);
    }
    prevTf.current = timeFormatFetcher.state;
  }, [timeFormatFetcher.state, timeFormatFetcher.data, revalidator]);

  useEffect(() => {
    if (
      prevDf.current === "submitting" &&
      dateFormatFetcher.state === "idle" &&
      dateFormatFetcher.data?.success
    ) {
      toast.success("Date format saved");
      revalidator.revalidate();
    }
    if (
      prevDf.current === "submitting" &&
      dateFormatFetcher.state === "idle" &&
      dateFormatFetcher.data?.error
    ) {
      toast.error(dateFormatFetcher.data.error);
    }
    prevDf.current = dateFormatFetcher.state;
  }, [dateFormatFetcher.state, dateFormatFetcher.data, revalidator]);

  const submitTimezone = (value: string) => {
    const parsed = updateTimezoneClientSchema.safeParse({ timezone: value });
    if (!parsed.success) return;
    if (parsed.data.timezone === (timezone ?? "Etc/UTC")) return;
    const formData = formDataToFormData(parsed.data, "update_timezone");
    timezoneFetcher.submit(formData, { method: "post" });
  };

  const persistTimeFormat = (value: "12h" | "24h") => {
    if (value === initialTimeFormat) return;
    const formData = new FormData();
    formData.append("_action", "update_time_format");
    formData.append("timeFormat", value);
    timeFormatFetcher.submit(formData, { method: "post" });
  };

  const persistDateFormat = (value: DateFormatKey) => {
    if (value === initialDateFormat) return;
    const formData = new FormData();
    formData.append("_action", "update_date_format");
    formData.append("dateFormat", value);
    dateFormatFetcher.submit(formData, { method: "post" });
  };

  const tzSubmitting = timezoneFetcher.state === "submitting";
  const tfSubmitting = timeFormatFetcher.state === "submitting";
  const dfSubmitting = dateFormatFetcher.state === "submitting";

  return (
    <PreferenceSection
      title="Regional & display"
      description={`Set how time and dates appear across ${BRAND_NAME}.`}
      contentClassName="mt-4 space-y-0"
    >
      <div className="border-border/60 space-y-2 border-b pb-4">
        <div className="space-y-1">
          <Label htmlFor="regional-timezone" className="text-sm font-medium">
            Timezone
          </Label>
          <p className="text-muted-foreground text-xs leading-snug">
            Used for scheduling posts and calendar views.
          </p>
        </div>
        <SearchableTimezoneSelector
          id="regional-timezone"
          value={tzForm.watch("timezone")}
          onValueChange={(value) => {
            tzForm.setValue("timezone", value, { shouldValidate: true });
            submitTimezone(value);
          }}
          disabled={tzSubmitting}
        />
        {tzForm.formState.errors.timezone ? (
          <p className="text-destructive text-sm">
            {tzForm.formState.errors.timezone.message}
          </p>
        ) : null}
      </div>

      <div className="border-border/60 space-y-2 border-b py-4">
        <div className="space-y-1">
          <Label htmlFor="regional-time-format" className="text-sm font-medium">
            Time format
          </Label>
          <p className="text-muted-foreground text-xs leading-snug">
            Choose how time appears across {BRAND_NAME}.
          </p>
        </div>
        <Select
          value={timeFormat}
          onValueChange={(value) => {
            const v = value as "12h" | "24h";
            setTimeFormat(v);
            persistTimeFormat(v);
          }}
          disabled={tfSubmitting}
        >
          <SelectTrigger id="regional-time-format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
            <SelectItem value="24h">24-hour</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 pt-4">
        <div className="space-y-1">
          <Label htmlFor="regional-date-format" className="text-sm font-medium">
            Date format
          </Label>
          <p className="text-muted-foreground text-xs leading-snug">
            Choose how dates appear in lists and previews.
          </p>
        </div>
        <Select
          value={dateFormat}
          onValueChange={(value) => {
            const v = value as DateFormatKey;
            setDateFormat(v);
            persistDateFormat(v);
          }}
          disabled={dfSubmitting}
        >
          <SelectTrigger id="regional-date-format">
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
