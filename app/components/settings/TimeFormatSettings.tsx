/**
 * Time Format Settings — 12h vs 24h display.
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

interface TimeFormatSettingsProps {
  timeFormat: "12h" | "24h";
}

export function TimeFormatSettings({
  timeFormat: initialTimeFormat,
}: TimeFormatSettingsProps) {
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();
  const revalidator = useRevalidator();
  const prevFetcherState = useRef(fetcher.state);
  const [timeFormat, setTimeFormat] = useState(initialTimeFormat);

  useEffect(() => {
    setTimeFormat(initialTimeFormat);
  }, [initialTimeFormat]);

  const isSubmitting = fetcher.state === "submitting";

  useEffect(() => {
    if (
      prevFetcherState.current === "submitting" &&
      fetcher.state === "idle" &&
      fetcher.data?.success
    ) {
      toast.success("Time format saved");
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

  const persist = (value: "12h" | "24h") => {
    if (value === initialTimeFormat) return;
    const formData = new FormData();
    formData.append("_action", "update_time_format");
    formData.append("timeFormat", value);
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <PreferenceSection
      title="Time format"
      description="How clocks are shown across the app."
    >
      <div className="space-y-2">
        <Label htmlFor="timeFormat">Format</Label>
        <Select
          value={timeFormat}
          onValueChange={(value) => {
            const v = value as "12h" | "24h";
            setTimeFormat(v);
            persist(v);
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
    </PreferenceSection>
  );
}
