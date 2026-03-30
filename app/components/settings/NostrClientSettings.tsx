/**
 * Preferred Nostr Client — where "View note/article" links open.
 */

import { useFetcher, useRevalidator } from "@remix-run/react";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
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
  const [preferredNostrClient, setPreferredNostrClient] = useState<string>(
    initialClient || "PRIMAL"
  );
  const [customNostrClientBaseUrl, setCustomNostrClientBaseUrl] = useState(
    initialCustomUrl ?? ""
  );

  useEffect(() => {
    queueMicrotask(() => {
      setPreferredNostrClient(initialClient || "PRIMAL");
      setCustomNostrClientBaseUrl(initialCustomUrl ?? "");
    });
  }, [initialClient, initialCustomUrl]);

  const isSubmitting = fetcher.state === "submitting";
  const hasChanged =
    preferredNostrClient !== (initialClient || "PRIMAL") ||
    customNostrClientBaseUrl !== (initialCustomUrl ?? "");

  useEffect(() => {
    if (fetcher.data?.success) {
      revalidator.revalidate();
    }
  }, [fetcher.data?.success, revalidator]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("_action", "update_preferred_nostr_client");
    formData.append("preferredNostrClient", preferredNostrClient);
    if (preferredNostrClient === "CUSTOM" && customNostrClientBaseUrl.trim()) {
      formData.append(
        "customNostrClientBaseUrl",
        customNostrClientBaseUrl.trim()
      );
    }
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <PreferenceSection
      title="Preferred Nostr client"
      description='Where "View note" and "View article" links open (e.g. Primal, Damus, Iris).'
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="preferredNostrClient">Client</Label>
          <Select
            value={preferredNostrClient}
            onValueChange={setPreferredNostrClient}
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
              onChange={(e) => setCustomNostrClientBaseUrl(e.target.value)}
              disabled={isSubmitting}
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground text-xs">
              Must start with https://. Paths /e/, /a/, /p/ will be appended for
              notes, articles, and profiles.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={isSubmitting || !hasChanged}
            size="sm"
          >
            {isSubmitting ? "Saving…" : "Save client"}
          </Button>
          {fetcher.data?.success ? (
            <span className="text-success text-sm">Saved.</span>
          ) : null}
          {fetcher.data?.error ? (
            <span className="text-destructive text-sm">
              {fetcher.data.error}
            </span>
          ) : null}
        </div>
      </form>
    </PreferenceSection>
  );
}
