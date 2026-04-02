/**
 * Appearance — account default theme (System / Light / Dark).
 * Header toggle can override for this browser only until you save here again.
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
import {
  clearSessionThemeOverride,
  getSessionThemeOverride,
  notifyThemeSessionChanged,
  setSessionThemeOverride,
  type StoredThemePreference,
} from "~/lib/theme.client";

type AccountThemePreference = StoredThemePreference | null;

interface ThemePreferenceFetcherData {
  success?: boolean;
  error?: string;
  themePreference?: StoredThemePreference;
}

export function ThemePreferenceSettings({
  themePreference,
}: {
  themePreference: AccountThemePreference;
}) {
  const fetcher = useFetcher<ThemePreferenceFetcherData>();
  const revalidator = useRevalidator();
  const revalidatorRef = useRef(revalidator);
  useEffect(() => {
    revalidatorRef.current = revalidator;
  }, [revalidator]);

  const pendingClearExpectedRef = useRef<StoredThemePreference | null>(null);
  const snapshotRef = useRef<{ captured: StoredThemePreference | null } | null>(
    null
  );
  const prevFetcherStateRef = useRef(fetcher.state);

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
    const wasSubmitting = prevFetcherStateRef.current === "submitting";
    prevFetcherStateRef.current = fetcher.state;
    if (!wasSubmitting || fetcher.state !== "idle") return;
    const d = fetcher.data;
    if (d?.success && d.themePreference) {
      pendingClearExpectedRef.current = d.themePreference;
      revalidatorRef.current.revalidate();
    }
  }, [fetcher.state, fetcher.data]);

  useEffect(() => {
    const expected = pendingClearExpectedRef.current;
    if (expected == null) return;
    const current = themePreference ?? "system";
    if (current === expected) {
      clearSessionThemeOverride();
      notifyThemeSessionChanged();
      pendingClearExpectedRef.current = null;
    }
  }, [themePreference]);

  useEffect(() => {
    if (fetcher.state !== "idle" || fetcher.data == null) return;
    if (fetcher.data.success) return;
    if (!("error" in fetcher.data) || !fetcher.data.error) return;
    const snap = snapshotRef.current;
    if (snap == null) return;
    snapshotRef.current = null;
    if (snap.captured === null) clearSessionThemeOverride();
    else setSessionThemeOverride(snap.captured);
    notifyThemeSessionChanged();
  }, [fetcher.data, fetcher.state]);

  const submit = (next: StoredThemePreference) => {
    snapshotRef.current = { captured: getSessionThemeOverride() };
    setSessionThemeOverride(next);
    notifyThemeSessionChanged();

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
      description={`Default look for new visits and other devices. The header theme button only affects this browser until you save here.`}
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
