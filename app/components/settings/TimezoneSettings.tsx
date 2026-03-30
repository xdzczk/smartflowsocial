import { useFetcher, useRevalidator } from "@remix-run/react";
import { useEffect, useRef } from "react";
import toast from "react-hot-toast";

import { SearchableTimezoneSelector } from "~/components/settings/SearchableTimezoneSelector";
import { Label } from "~/components/ui/label";
import { PreferenceSection } from "~/features/settings/components/patterns";
import { updateTimezoneClientSchema } from "~/lib/validation";
import {
  useZodForm,
  formDataToFormData,
} from "~/lib/validation/utils.client-safe";

interface TimezoneSettingsProps {
  timezone: string | null;
}

interface FetcherData {
  success?: boolean;
  error?: string;
}

export function TimezoneSettings({ timezone }: TimezoneSettingsProps) {
  const fetcher = useFetcher<FetcherData>();
  const revalidator = useRevalidator();
  const prevFetcherState = useRef(fetcher.state);
  const form = useZodForm(updateTimezoneClientSchema, {
    defaultValues: {
      timezone: timezone ?? "Etc/UTC",
    },
  });

  const isSubmitting = fetcher.state === "submitting";

  useEffect(() => {
    form.reset({ timezone: timezone ?? "Etc/UTC" });
  }, [timezone, form]);

  useEffect(() => {
    if (
      prevFetcherState.current === "submitting" &&
      fetcher.state === "idle" &&
      fetcher.data?.success
    ) {
      toast.success("Timezone saved");
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

  const submitTimezone = (value: string) => {
    const parsed = updateTimezoneClientSchema.safeParse({ timezone: value });
    if (!parsed.success) return;
    if (parsed.data.timezone === (timezone ?? "Etc/UTC")) return;
    const formData = formDataToFormData(parsed.data, "update_timezone");
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <PreferenceSection
      title="Timezone"
      description="Used for scheduling posts and calendar views."
    >
      <div className="space-y-2">
        <Label htmlFor="timezone">Timezone</Label>
        <SearchableTimezoneSelector
          id="timezone"
          value={form.watch("timezone")}
          onValueChange={(value) => {
            form.setValue("timezone", value, { shouldValidate: true });
            submitTimezone(value);
          }}
          disabled={isSubmitting}
        />
        {form.formState.errors.timezone ? (
          <p className="text-destructive text-sm">
            {form.formState.errors.timezone.message}
          </p>
        ) : null}
      </div>
    </PreferenceSection>
  );
}
