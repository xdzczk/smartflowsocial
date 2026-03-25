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
import {
  useZodForm,
  formDataToFormData,
} from "~/lib/validation/utils.client-safe";

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
      "update_nwc"
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
      // Defer to avoid cascading renders
      setTimeout(() => {
        form.setValue("nwcString", "");
        setShowInput(false);
      }, 0);
    }
  }, [fetcher.data?.success, form]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auto-renew wallet</CardTitle>
        <CardDescription>
          Connect a Lightning wallet for automatic subscription renewals.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit(e);
          }}
          className="space-y-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-0.5">
              <Label htmlFor="nwc-enabled">Enable auto-renew</Label>
              <p className="text-muted-foreground text-sm">
                SmartFlow never holds your funds. You can revoke wallet access
                at any time.
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
                  <Label>Connected wallet</Label>
                  <div className="bg-muted space-y-2 rounded-md p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="min-w-0 font-mono text-sm break-all">
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
                      <p className="text-muted-foreground text-xs">
                        Last used: {new Date(nwcLastUsed).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowInput(true)}
                      disabled={isSubmitting}
                    >
                      Update wallet
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleClear}
                      disabled={isSubmitting}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : null}

              {showInput ? (
                <div className="space-y-2">
                  <Label htmlFor="nwc-string">NWC connection string</Label>
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
                  <p className="text-muted-foreground text-xs">
                    This will be encrypted and stored securely.
                  </p>
                </div>
              ) : null}

              {!maskedNwcString && !showInput ? (
                <div className="space-y-2">
                  <Label htmlFor="nwc-string">NWC connection string</Label>
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
                  <p className="text-muted-foreground text-xs">
                    This will be encrypted and stored securely.
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
            {isSubmitting ? "Saving..." : "Save wallet settings"}
          </Button>

          {fetcher.data?.success ? (
            <p className="text-success text-sm">
              NWC settings updated successfully!
            </p>
          ) : null}
          {fetcher.data?.error ? (
            <p className="text-destructive text-sm">{fetcher.data.error}</p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
