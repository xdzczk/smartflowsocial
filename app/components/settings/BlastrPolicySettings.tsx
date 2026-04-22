import { useFetcher } from "@remix-run/react";
import { X } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";

interface BlastrPolicySettingsProps {
  policy: { mode: "blacklist" | "whitelist"; enabled: boolean } | null;
  relays: Array<{ relay_url: string; action: "allow" | "block" }>;
  systemRelays: string[];
  /** When true, render content only (no Card wrapper) for use inside a modal. */
  asModalContent?: boolean;
}

interface FetcherData {
  success?: boolean;
  error?: string;
}

export function BlastrPolicySettings({
  policy,
  relays,
  systemRelays,
  asModalContent = false,
}: BlastrPolicySettingsProps) {
  const policyFetcher = useFetcher<FetcherData>();
  const addFetcher = useFetcher<FetcherData>();
  const removeFetcher = useFetcher<FetcherData>();

  const mode = policy?.mode ?? "blacklist";
  const enabled = policy?.enabled ?? true;
  const isSubmitting =
    policyFetcher.state === "submitting" ||
    addFetcher.state === "submitting" ||
    removeFetcher.state === "submitting";

  const handlePolicyChange = (
    newMode: "blacklist" | "whitelist",
    newEnabled: boolean
  ) => {
    const formData = new FormData();
    formData.set("_action", "update_blastr_policy");
    formData.set("mode", newMode);
    formData.set("enabled", newEnabled ? "true" : "false");
    policyFetcher.submit(formData, { method: "post" });
  };

  const handleAddRelay = (relayUrl: string, action: "allow" | "block") => {
    const formData = new FormData();
    formData.set("_action", "add_blastr_policy_relay");
    formData.set("relay_url", relayUrl);
    formData.set("action", action);
    addFetcher.submit(formData, { method: "post" });
  };

  const handleRemoveRelay = (relayUrl: string) => {
    const formData = new FormData();
    formData.set("_action", "remove_blastr_policy_relay");
    formData.set("relay_url", relayUrl);
    removeFetcher.submit(formData, { method: "post" });
  };

  const existingUrls = new Set(relays.map((r) => r.relay_url));
  const availableToAdd = systemRelays.filter((url) => !existingUrls.has(url));

  const content = (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="cluster">
          <Label htmlFor="blastr-policy-mode" className="text-sm font-medium">
            Mode
          </Label>
          <Select
            value={mode}
            onValueChange={(value: "blacklist" | "whitelist") =>
              handlePolicyChange(value, enabled)
            }
            disabled={isSubmitting}
          >
            <SelectTrigger id="blastr-policy-mode" className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="blacklist">Blacklist</SelectItem>
              <SelectItem value="whitelist">Whitelist</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="cluster">
          <Switch
            id="blastr-policy-enabled"
            checked={enabled}
            onCheckedChange={(checked) => handlePolicyChange(mode, checked)}
            disabled={isSubmitting}
          />
          <Label
            htmlFor="blastr-policy-enabled"
            className="text-sm font-normal"
          >
            Apply policy
          </Label>
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">
          {mode === "blacklist" ? "Blocked relays" : "Allowed relays"}
        </div>
        {relays.length === 0 ? (
          <p className="text-text-secondary text-sm">
            {mode === "blacklist"
              ? "No relays blocked; Blastr will use all system relays."
              : "No relays allowed; add relays to whitelist."}
          </p>
        ) : (
          <ul className="space-y-2">
            {relays.map((r) => (
              <li
                key={r.relay_url}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span className="font-mono break-all">{r.relay_url}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveRelay(r.relay_url)}
                  disabled={isSubmitting}
                >
                  <X className={INLINE_ICON_SIZE_CLASS} />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {availableToAdd.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Select
              onValueChange={(value) => {
                const action = mode === "blacklist" ? "block" : "allow";
                handleAddRelay(value, action);
              }}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Add relay…" />
              </SelectTrigger>
              <SelectContent>
                {availableToAdd.map((url) => (
                  <SelectItem key={url} value={url}>
                    {url}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {policyFetcher.data?.error ||
      addFetcher.data?.error ||
      removeFetcher.data?.error ? (
        <p className="text-danger text-sm">
          {policyFetcher.data?.error ??
            addFetcher.data?.error ??
            removeFetcher.data?.error}
        </p>
      ) : null}
      {policyFetcher.data?.success ||
      addFetcher.data?.success ||
      removeFetcher.data?.success ? (
        <p className="text-success text-sm">Saved.</p>
      ) : null}
    </div>
  );

  if (asModalContent) return content;

  return (
    <Card>
      <CardHeader>
        <CardTitle>SFS Blastr relay policy</CardTitle>
        <CardDescription>
          Choose which relays Blastr fans out to. Blacklist = all system relays
          except blocked; whitelist = only allowed relays.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">{content}</CardContent>
    </Card>
  );
}
