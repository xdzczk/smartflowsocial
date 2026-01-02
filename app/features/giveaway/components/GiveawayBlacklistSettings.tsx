import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";

import { DynamicInputList } from "~/components/settings/DynamicInputList";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

interface GiveawayBlacklistSettingsProps {
  giveawayBlacklist: string[];
}

interface FetcherData {
  success?: boolean;
  error?: string;
}

export function GiveawayBlacklistSettings({
  giveawayBlacklist,
}: GiveawayBlacklistSettingsProps) {
  const fetcher = useFetcher<FetcherData>();
  const [blacklistState, setBlacklistState] = useState(giveawayBlacklist || []);

  const isSubmitting = fetcher.state === "submitting";
  const hasChanged =
    JSON.stringify(blacklistState) !== JSON.stringify(giveawayBlacklist);

  useEffect(() => {
    if (giveawayBlacklist) {
      setBlacklistState(giveawayBlacklist);
    }
  }, [giveawayBlacklist]);

  const validateNpub = (npub: string) => {
    return npub.startsWith("npub1") && npub.length >= 63;
  };

  const hasValidationErrors = blacklistState.some(
    (npub) => npub.trim() && !validateNpub(npub.trim()),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const blacklistItems = blacklistState.filter((item) => item.trim());
    const formData = new FormData();
    formData.set("_action", "update_blacklist");
    formData.set("blacklist", blacklistItems.join("\n"));
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Giveaway Blacklist</CardTitle>
        <CardDescription>
          Manage blocked npub addresses for giveaways and contests
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DynamicInputList
            items={blacklistState}
            setItems={setBlacklistState}
            placeholder="npub1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            validate={validateNpub}
            disabled={isSubmitting}
            description="Add npub addresses one by one"
          />

          <Button
            type="submit"
            disabled={isSubmitting || !hasChanged || hasValidationErrors}
            className="w-full"
          >
            {isSubmitting ? "Saving..." : "Save Blacklist"}
          </Button>

          {fetcher.data?.success ? (
            <p className="text-sm text-green-600">
              Blacklist updated successfully!
            </p>
          ) : null}
          {fetcher.data?.error ? (
            <p className="text-sm text-destructive">{fetcher.data.error}</p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
