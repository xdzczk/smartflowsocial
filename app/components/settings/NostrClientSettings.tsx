/**
 * Preferred Nostr Client  -  where "View note/article" links open.
 */

import { useFetcher, useRevalidator } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { PreferenceSection } from "~/features/settings/components/patterns";
import type { PreferredNostrClientPreset } from "~/features/user";

const PRESET_OPTIONS: Array<{
  value: PreferredNostrClientPreset;
  label: string;
}> = [
  { value: "PRIMAL", label: "Primal" },
  { value: "DAMUS", label: "Damus" },
  { value: "AMETHYST", label: "Amethyst" },
  { value: "NOSTUR", label: "Nostur" },
  { value: "NOSTRUDEL", label: "noStrudel" },
  { value: "IRIS", label: "Iris" },
  { value: "YAKIHONNE", label: "Yakihonne" },
  { value: "JUMBLE", label: "Jumble Social" },
  { value: "CUSTOM", label: "Custom URL" },
];

interface NostrClientSettingsProps {
  preferredNostrClient: string;
  customNostrClientBaseUrl: string | null;
}

export function NostrClientSettings({
  preferredNostrClient: initialClient,
  customNostrClientBaseUrl: initialCustomUrl,
}: NostrClientSettingsProps) {
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();
  const revalidator = useRevalidator();
  const revalidatorRef = useRef(revalidator);
  useEffect(() => {
    revalidatorRef.current = revalidator;
  }, [revalidator]);
  const [preferredNostrClient, setPreferredNostrClient] = useState<string>(
    initialClient || "PRIMAL"
  );
  const [customNostrClientBaseUrl, setCustomNostrClientBaseUrl] = useState(
    initialCustomUrl ?? ""
  );
  const lastSavedRef = useRef({
    client: initialClient || "PRIMAL",
    url: initialCustomUrl ?? "",
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setPreferredNostrClient(initialClient || "PRIMAL");
      setCustomNostrClientBaseUrl(initialCustomUrl ?? "");
      lastSavedRef.current = {
        client: initialClient || "PRIMAL",
        url: initialCustomUrl ?? "",
      };
    });
  }, [initialClient, initialCustomUrl]);

  useEffect(() => {
    if (fetcher.data?.success) {
      revalidatorRef.current.revalidate();
    }
    // Do not depend on `revalidator`: its identity changes after each revalidate and would loop forever.
  }, [fetcher.data?.success]);

  const submitIfNeeded = (
    client: string,
    url: string,
    opts?: { immediate?: boolean }
  ) => {
    const run = () => {
      const sameClient = client === lastSavedRef.current.client;
      const sameUrl =
        (url.trim() || "") === (lastSavedRef.current.url.trim() || "");
      if (sameClient && sameUrl) return;

      const formData = new FormData();
      formData.append("_action", "update_preferred_nostr_client");
      formData.append("preferredNostrClient", client);
      if (client === "CUSTOM" && url.trim()) {
        formData.append("customNostrClientBaseUrl", url.trim());
      }
      fetcher.submit(formData, {
        method: "post",
        action: "/dashboard/settings",
      });
      lastSavedRef.current = { client, url: url.trim() };
    };

    if (opts?.immediate) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      run();
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(run, 400);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const isSubmitting = fetcher.state === "submitting";

  return (
    <PreferenceSection
      title="Preferred Nostr client"
      description='Choose where "View note" and "View article" links open. Changes save automatically.'
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="preferredNostrClient">Client</Label>
          <Select
            value={preferredNostrClient}
            onValueChange={(v) => {
              setPreferredNostrClient(v);
              submitIfNeeded(v, v === "CUSTOM" ? customNostrClientBaseUrl : "");
            }}
            disabled={isSubmitting}
          >
            <SelectTrigger id="preferredNostrClient">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESET_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {preferredNostrClient === "CUSTOM" ? (
          <div className="space-y-2">
            <Label htmlFor="customNostrClientBaseUrl">Base URL</Label>
            <Input
              id="customNostrClientBaseUrl"
              type="url"
              placeholder="https://example.com"
              value={customNostrClientBaseUrl}
              onChange={(e) => {
                const next = e.target.value;
                setCustomNostrClientBaseUrl(next);
                submitIfNeeded("CUSTOM", next);
              }}
              onBlur={() =>
                submitIfNeeded("CUSTOM", customNostrClientBaseUrl, {
                  immediate: true,
                })
              }
              disabled={isSubmitting}
              className="font-mono text-sm"
            />
            <p className="text-text-secondary text-xs">
              Must start with https://. Paths /e/, /a/, /p/ will be appended for
              notes, articles, and profiles.
            </p>
          </div>
        ) : null}

        <div className="text-text-secondary flex min-h-[1.25rem] flex-wrap items-center gap-2 text-xs">
          {fetcher.data?.success ? (
            <span className="text-success">Saved.</span>
          ) : null}
          {fetcher.data?.error ? (
            <span className="text-danger">{fetcher.data.error}</span>
          ) : null}
        </div>
      </div>
    </PreferenceSection>
  );
}
