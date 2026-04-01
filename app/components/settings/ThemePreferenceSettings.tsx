/**
 * Appearance — theme preference (System / Light / Dark).
 * Persists to account (server) and applies immediately on this device.
 */

import { useFetcher, useRevalidator } from "@remix-run/react";
import { useEffect, useMemo, useRef } from "react";

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
import {
  applyThemePreferenceToDocument,
  setStoredThemePreference,
  type StoredThemePreference,
} from "~/lib/theme.client";

type AccountThemePreference = StoredThemePreference | null;

export function ThemePreferenceSettings({
  themePreference,
}: {
  themePreference: AccountThemePreference;
}) {
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();
  const revalidator = useRevalidator();
  const revalidatorRef = useRef(revalidator);
  useEffect(() => {
    revalidatorRef.current = revalidator;
  }, [revalidator]);

  const value: StoredThemePreference = useMemo(() => {
    const pending =
      fetcher.state === "submitting"
        ? fetcher.formData?.get("themePreference")
        : null;
    if (pending === "system" || pending === "light" || pending === "dark") {
      return pending;
    }
    return themePreference ?? "system";
  }, [fetcher.formData, fetcher.state, themePreference]);

  useEffect(() => {
    if (fetcher.data?.success) {
      revalidatorRef.current.revalidate();
    }
  }, [fetcher.data?.success]);

  const submit = (next: StoredThemePreference) => {
    // Apply immediately on this device.
    setStoredThemePreference(next);
    applyThemePreferenceToDocument(next);

    const formData = new FormData();
    formData.append("_action", "update_theme_preference");
    formData.append("themePreference", next);
    fetcher.submit(formData, { method: "post", action: "/dashboard/settings" });
  };

  const isSubmitting = fetcher.state === "submitting";

  const helper = useMemo(() => {
    if (value === "system") return "Follows your device setting.";
    if (value === "light") return "Always use light theme.";
    return "Always use dark theme.";
  }, [value]);

  return (
    <PreferenceSection
      title="Appearance"
      description={`Choose how ${BRAND_NAME} looks on this device. Saved to your account.`}
    >
      <div className="space-y-2">
        <Label htmlFor="themePreference">Theme</Label>
        <Select
          value={value}
          onValueChange={(v) => {
            const next = v as StoredThemePreference;
            submit(next);
          }}
          disabled={isSubmitting}
        >
          <SelectTrigger id="themePreference">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">System</SelectItem>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">{helper}</p>
        <div className="text-muted-foreground flex min-h-[1.25rem] flex-wrap items-center gap-2 text-xs">
          {fetcher.data?.success ? (
            <span className="text-success">Saved.</span>
          ) : null}
          {fetcher.data?.error ? (
            <span className="text-destructive">{fetcher.data.error}</span>
          ) : null}
        </div>
      </div>
    </PreferenceSection>
  );
}
