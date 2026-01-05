import { useFetcher } from "@remix-run/react";
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
import { Switch } from "~/components/ui/switch";
import { updateNWCClientSchema } from "~/lib/validation";
import { useZodForm, formDataToFormData } from "~/lib/validation/utils.client-safe";

interface NWCSettingsProps {
  nwcEnabled: boolean;
  maskedNwcString?: string;
  nwcLastUsed?: string | null;
}

interface FetcherData {
  success?: boolean;
  error?: string;
}

export function NWCSettings({
  nwcEnabled,
  maskedNwcString,
  nwcLastUsed,
}: NWCSettingsProps) {
  const fetcher = useFetcher<FetcherData>();
  const form = useZodForm(updateNWCClientSchema, {
    defaultValues: {
      nwcEnabled,
      nwcString: "",
    },
  });

  const [showInput, setShowInput] = useState(false);

  const isSubmitting = fetcher.state === "submitting";
  const watchedEnabled = form.watch("nwcEnabled");
  const watchedNwcString = form.watch("nwcString");
  const hasChanged =
    watchedEnabled !== nwcEnabled || (watchedNwcString?.trim() ?? "") !== "";

  const onSubmit = form.handleSubmit((data) => {
    const formData = formDataToFormData(
      {
        nwcEnabled: data.nwcEnabled,
        ...(data.nwcString?.trim() ? { nwcString: data.nwcString.trim() } : {}),
      },
      "update_nwc",
    );

    fetcher.submit(formData, { method: "post" });
  });

  const handleClear = () => {
    const formData = new FormData();
    formData.set("_action", "clear_nwc");
    fetcher.submit(formData, { method: "post" });
  };

  // Reset form state when fetcher completes successfully
  useEffect(() => {
    if (fetcher.data?.success) {
      form.setValue("nwcString", "");
      setShowInput(false);
    }
  }, [fetcher.data?.success, form]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nostr Wallet Connect (NWC)</CardTitle>
        <CardDescription>
          Connect your lightning wallet for automated payments and transactions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); void onSubmit(e); }} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="nwc-enabled">Enable NWC</Label>
              <p className="text-sm text-muted-foreground">
                Allow automated lightning payments through your wallet
              </p>
            </div>
            <Switch
              id="nwc-enabled"
              checked={watchedEnabled}
              onCheckedChange={(checked) => {
                form.setValue("nwcEnabled", checked);
              }}
              disabled={isSubmitting}
            />
          </div>

          {watchedEnabled ? (
            <div className="space-y-4">
              {maskedNwcString && !showInput ? (
                <div className="space-y-2">
                  <Label>Current NWC Connection</Label>
                  <div className="space-y-2 rounded-md bg-muted p-3">
                    <div className="flex items-center justify-between">
                      <p className="break-all font-mono text-sm">
                        {maskedNwcString}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          void navigator.clipboard.writeText(maskedNwcString);
                        }}
                        className="ml-2 h-6 px-2 text-xs"
                      >
                        Copy
                      </Button>
                    </div>
                    {nwcLastUsed ? (
                      <p className="text-xs text-muted-foreground">
                        Last used: {new Date(nwcLastUsed).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowInput(true)}
                      disabled={isSubmitting}
                    >
                      Update Connection
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleClear}
                      disabled={isSubmitting}
                    >
                      Clear Connection
                    </Button>
                  </div>
                </div>
              ) : null}

              {showInput ? (
                <div className="space-y-2">
                  <Label htmlFor="nwc-string">NWC Connection String</Label>
                  <Input
                    id="nwc-string"
                    type="text"
                    placeholder="nostr+walletconnect://..."
                    {...form.register("nwcString")}
                    disabled={isSubmitting}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter your Nostr Wallet Connect connection string. This will
                    be encrypted and stored securely.
                  </p>
                </div>
              ) : null}

              {!maskedNwcString && !showInput ? (
                <div className="space-y-2">
                  <Label htmlFor="nwc-string">NWC Connection String</Label>
                  <Input
                    id="nwc-string"
                    type="text"
                    placeholder="nostr+walletconnect://..."
                    {...form.register("nwcString")}
                    disabled={isSubmitting}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter your Nostr Wallet Connect connection string. This will
                    be encrypted and stored securely.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={isSubmitting || !hasChanged}
            className="w-full"
          >
            {isSubmitting ? "Saving..." : "Save NWC Settings"}
          </Button>

          {fetcher.data?.success ? (
            <p className="text-sm text-green-600">
              NWC settings updated successfully!
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
