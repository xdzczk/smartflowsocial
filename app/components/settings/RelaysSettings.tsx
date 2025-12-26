import { useFetcher } from "@remix-run/react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

import { DynamicInputList } from "./DynamicInputList";

interface RelaysSettingsProps {
  relays: string[];
}

interface FetcherData {
  success?: boolean;
  error?: string;
}

export function RelaysSettings({ relays }: RelaysSettingsProps) {
  const fetcher = useFetcher<FetcherData>();
  const [userRelays, setUserRelays] = useState(relays || []);
  const [relayErrors, setRelayErrors] = useState<string[]>([]);

  const isSubmitting = fetcher.state === "submitting";
  const hasChanged = JSON.stringify(userRelays) !== JSON.stringify(relays);

  const validateRelay = (relay: string) => {
    const relayRegex =
      /^wss:\/\/[a-zA-Z0-9][a-zA-Z0-9-._]+\.[a-zA-Z]{2,}(:[0-9]+)?(\/.*)?$/;
    return relayRegex.test(relay);
  };

  const hasValidationErrors = userRelays.some(
    (relay) => relay.trim() && !validateRelay(relay.trim()),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const relayList = userRelays.filter((relay) => relay.trim());

    if (hasValidationErrors) {
      setRelayErrors(["Please fix validation errors before submitting"]);
      return;
    }

    const errors: string[] = [];
    relayList.forEach((relay, index) => {
      if (!validateRelay(relay.trim())) {
        errors.push(
          `Item ${index + 1}: Invalid relay format. Must start with wss:// and have a valid domain`,
        );
      }
    });

    if (errors.length > 0) {
      setRelayErrors(errors);
      return;
    }

    setRelayErrors([]);
    const formData = new FormData();
    formData.set("_action", "update_relays");
    formData.set("relays", relayList.join("\n"));
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nostr Relays</CardTitle>
        <CardDescription>
          Manage your Nostr relay connections for publishing posts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DynamicInputList
            items={userRelays}
            setItems={(newRelays) => {
              setUserRelays(newRelays);
              setRelayErrors([]);
            }}
            placeholder="wss://relay.damus.io"
            validate={validateRelay}
            disabled={isSubmitting}
            preventSpaces={true}
            description="Add relay URLs one by one"
          />

          {relayErrors.length > 0 ? (
            <div className="space-y-1">
              {relayErrors.map((error, index) => (
                <p key={index} className="text-sm text-destructive">
                  {error}
                </p>
              ))}
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={isSubmitting || !hasChanged || hasValidationErrors}
            className="w-full"
          >
            {isSubmitting ? "Saving..." : "Save Relays"}
          </Button>

          {fetcher.data?.success ? (
            <p className="text-sm text-green-600">
              Relays updated successfully!
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
