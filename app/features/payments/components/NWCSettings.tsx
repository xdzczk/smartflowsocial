import { useFetcher } from "@remix-run/react";
import { Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { PreferenceSection } from "~/features/settings/components/patterns";
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
  const trimmedNew = watchedNwcString?.trim() ?? "";
  const hasPendingConnectionString = trimmedNew.length > 0;

  const onSubmitConnection = form.handleSubmit((data) => {
    const formData = formDataToFormData(
      {
        nwcEnabled: true,
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

  const submitToggleOnly = (nextEnabled: boolean) => {
    const formData = formDataToFormData(
      { nwcEnabled: nextEnabled, nwcString: "" },
      "update_nwc"
    );
    fetcher.submit(formData, { method: "post" });
  };

  useEffect(() => {
    if (fetcher.data?.success) {
      setTimeout(() => {
        form.setValue("nwcString", "");
        setShowInput(false);
      }, 0);
    }
  }, [fetcher.data?.success, form]);

  useEffect(() => {
    form.setValue("nwcEnabled", nwcEnabled);
  }, [nwcEnabled, form]);

  const connected = Boolean(maskedNwcString);

  return (
    <PreferenceSection
      title="Auto-renew wallet"
      description="Connect a Lightning wallet (NWC) so subscription renewals can be paid automatically. SmartFlow never holds your funds—you can disconnect or revoke access at any time."
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="nwc-enabled">Enable auto-renew</Label>
            <p className="text-muted-foreground text-sm">
              When on, renewals can be charged via your connected wallet.
              SmartFlow never holds your funds.
            </p>
          </div>
          <Switch
            id="nwc-enabled"
            checked={watchedEnabled}
            onCheckedChange={(checked) => {
              form.setValue("nwcEnabled", checked);
              if (hasPendingConnectionString) {
                return;
              }
              submitToggleOnly(checked);
            }}
            disabled={isSubmitting}
          />
        </div>

        {!connected && !watchedEnabled && !showInput ? (
          <div className="border-border/60 bg-muted/20 rounded-lg border border-dashed p-5">
            <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left">
              <Wallet className="text-muted-foreground mb-3 h-10 w-10 shrink-0 sm:mr-4 sm:mb-0" />
              <div className="min-w-0 flex-1">
                <p className="text-foreground mb-1 text-sm font-medium">
                  No wallet connected
                </p>
                <p className="text-muted-foreground text-sm">
                  Turn on auto-renew above, or use Connect wallet to paste your
                  NWC string.
                </p>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowInput(true)}
                >
                  Connect wallet
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {connected && maskedNwcString && !showInput ? (
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
                  className="ml-2 h-6 shrink-0 px-2 text-xs"
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
                className="text-destructive hover:text-destructive"
                onClick={handleClear}
                disabled={isSubmitting}
              >
                Disconnect
              </Button>
            </div>
          </div>
        ) : null}

        {showInput || (!connected && watchedEnabled) ? (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void onSubmitConnection(e);
            }}
          >
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
              Encrypted and stored securely. Used for renewal payments when
              auto-renew is on.
            </p>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !trimmedNew}
            >
              {isSubmitting ? "Saving…" : "Save connection"}
            </Button>
          </form>
        ) : null}

        {fetcher.data?.success ? (
          <p className="text-success text-sm">Wallet settings updated.</p>
        ) : null}
        {fetcher.data?.error ? (
          <p className="text-destructive text-sm">{fetcher.data.error}</p>
        ) : null}
      </div>
    </PreferenceSection>
  );
}
