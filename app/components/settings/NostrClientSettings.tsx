/**
 * Preferred Nostr Client Settings
 * Lets users choose where "View note/article" links open (Primal, Damus, Amethyst, etc. or custom URL).
 */

import { useFetcher, useRevalidator } from "@remix-run/react";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <ExternalLink className="text-foreground h-5 w-5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <CardTitle>Preferred Nostr Client</CardTitle>
            <CardDescription>
              Choose where &quot;View note&quot; and &quot;View article&quot;
              links open (e.g. Primal, Damus, Iris)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="preferredNostrClient">Nostr client</Label>
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
                Must start with https://. Paths /e/, /a/, /p/ will be appended
                for notes, articles, and profiles.
              </p>
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={isSubmitting || !hasChanged}
            className="w-full"
          >
            {isSubmitting ? "Saving..." : "Save"}
          </Button>

          {fetcher.data?.success ? (
            <p className="text-success text-sm">Settings saved.</p>
          ) : null}
          {fetcher.data?.error ? (
            <p className="text-destructive text-sm">{fetcher.data.error}</p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
