import { useFetcher } from "@remix-run/react";
import { Plus, Settings2, X } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import { BlastrPolicySettings } from "~/components/settings/BlastrPolicySettings";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import { updateRelaysClientSchema } from "~/lib/validation";
import { useZodFieldArray } from "~/lib/validation/hooks/useZodFieldArray";
import { relayUrlSchema } from "~/lib/validation/schemas/settings.schemas";
import {
  useZodForm,
  formDataToFormData,
} from "~/lib/validation/utils.client-safe";

type PublishRelaySource = "app" | "nip65_profile";

interface RelaysSettingsProps {
  relays: string[];
  publishRelaySource: PublishRelaySource;
  /** NIP-65 write relays from kind 10002 (read-only preview). */
  profileRelays: string[];
  managedRelays: Array<{
    id: string;
    role: string;
    enabled: boolean;
    relayUrl: string;
  }>;
  relayAcks: Record<
    string,
    { status: string; createdAt: string; receivedAt: string | null }
  >;
  blastrRelayEnabled?: boolean;
  canToggleBlastr?: boolean;
  /** When true, show "Policy" button for Blastr relay to open policy modal. */
  canShowBlastrPolicyModal?: boolean;
  blastrPolicy?: { mode: "blacklist" | "whitelist"; enabled: boolean } | null;
  blastrPolicyRelays?: Array<{ relay_url: string; action: "allow" | "block" }>;
  blastrSystemRelays?: string[];
}

interface FetcherData {
  success?: boolean;
  error?: string;
}

function formatAck(
  ack:
    | { status: string; createdAt: string; receivedAt: string | null }
    | undefined
): string {
  if (!ack) return "—";
  const status = ack.status.toLowerCase();
  const at = ack.createdAt ? new Date(ack.createdAt).toLocaleString() : "";
  return at ? `${status} (${at})` : status;
}

export function RelaysSettings({
  relays,
  publishRelaySource: initialPublishRelaySource,
  profileRelays,
  managedRelays,
  relayAcks,
  blastrRelayEnabled = true,
  canToggleBlastr = false,
  canShowBlastrPolicyModal = false,
  blastrPolicy = null,
  blastrPolicyRelays = [],
  blastrSystemRelays = [],
}: RelaysSettingsProps) {
  const [blastrPolicyModalOpen, setBlastrPolicyModalOpen] = useState(false);
  const fetcher = useFetcher<FetcherData>();
  const blastrFetcher = useFetcher<FetcherData>();
  const form = useZodForm(updateRelaysClientSchema, {
    defaultValues: {
      relays: relays.length > 0 ? relays : [""],
      publishRelaySource: initialPublishRelaySource,
    },
  });

  const { fields, append, remove } = useZodFieldArray<
    z.infer<typeof updateRelaysClientSchema>,
    "relays"
  >(
    form as unknown as UseFormReturn<z.infer<typeof updateRelaysClientSchema>>,
    "relays"
  );

  const isSubmitting = fetcher.state === "submitting";
  const watchedRelays = form.watch("relays");
  const watchedSource = form.watch("publishRelaySource");
  const hasChanged =
    JSON.stringify(watchedRelays) !== JSON.stringify(relays) ||
    watchedSource !== initialPublishRelaySource;

  const onSubmit = form.handleSubmit((data) => {
    // Filter out empty strings and validate
    const filteredRelays = data.relays.filter((relay: string) => relay.trim());
    if (filteredRelays.length === 0) {
      form.setError("relays", {
        type: "manual",
        message: "At least one relay is required",
      });
      return;
    }

    // Validate all non-empty relays
    const invalidRelays = filteredRelays.filter((relay: string) => {
      try {
        relayUrlSchema.parse(relay);
        return false;
      } catch {
        return true;
      }
    });

    if (invalidRelays.length > 0) {
      form.setError("relays", {
        type: "manual",
        message:
          "All relay URLs must start with wss:// and have a valid domain",
      });
      return;
    }

    const formData = formDataToFormData(
      {
        relays: filteredRelays.join("\n"),
        publishRelaySource: data.publishRelaySource,
      },
      "update_relays"
    );

    fetcher.submit(formData, { method: "post" });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nostr Relays</CardTitle>
        <CardDescription>
          Choose whether publishes use your Nostr profile relay list (NIP-65,
          kind 10002) or the SmartFlow app list. Only one source is active.
          Managed relays are separate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 space-y-3">
          <div className="text-sm font-medium">Publish using</div>
          <div className="space-y-2">
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- radio nested in label */}
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                className="border-input mt-0.5"
                value="nip65_profile"
                checked={watchedSource === "nip65_profile"}
                onChange={() =>
                  form.setValue("publishRelaySource", "nip65_profile", {
                    shouldValidate: true,
                  })
                }
                disabled={isSubmitting}
              />
              <span>
                <span className="font-medium">Nostr profile relays</span>
                <span className="text-muted-foreground block text-xs font-normal">
                  Fetched from your latest kind 10002 (write / unmarked{" "}
                  <code className="text-xs">r</code> tags). Update them in your
                  Nostr client.
                </span>
              </span>
            </label>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- radio nested in label */}
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                className="border-input mt-0.5"
                value="app"
                checked={watchedSource === "app"}
                onChange={() =>
                  form.setValue("publishRelaySource", "app", {
                    shouldValidate: true,
                  })
                }
                disabled={isSubmitting}
              />
              <span>
                <span className="font-medium">SmartFlow app relay list</span>
                <span className="text-muted-foreground block text-xs font-normal">
                  Relays stored in SmartFlow (defaults until you change them).
                </span>
              </span>
            </label>
          </div>
        </div>

        {watchedSource === "nip65_profile" ? (
          <div className="bg-muted/30 mb-6 space-y-2 rounded-md border p-3">
            <div className="text-sm font-medium">
              Profile relays (read-only)
            </div>
            {profileRelays.length > 0 ? (
              <ul className="space-y-2">
                {profileRelays.map((url) => {
                  const ack = relayAcks[url];
                  return (
                    <li key={url} className="min-w-0">
                      <div className="font-mono text-sm break-all">{url}</div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Last ACK: {formatAck(ack)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                No NIP-65 write relays found on your profile yet. Publishing
                falls back to default relays until you publish a relay list from
                a Nostr client.
              </p>
            )}
          </div>
        ) : null}

        {managedRelays.length > 0 ? (
          <div className="mb-6 space-y-3">
            <div className="text-sm font-medium">Managed relays</div>
            {managedRelays.map((mr) => {
              const ack = relayAcks[mr.relayUrl];
              const isBlastr = mr.id === "blastr";
              const showBlastrToggle = isBlastr && canToggleBlastr;
              return (
                <div
                  key={mr.id}
                  className="flex items-start justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-sm break-all">
                      {mr.relayUrl}
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      SmartFlowSocial propagation relay ({mr.role})
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      Last ACK: {formatAck(ack)}
                    </div>
                    {showBlastrToggle ? (
                      <div className="mt-3 flex items-center gap-2">
                        <Switch
                          id="blastr-relay-enabled"
                          checked={blastrRelayEnabled}
                          onCheckedChange={(checked) => {
                            const formData = new FormData();
                            formData.set(
                              "_action",
                              "update_blastr_relay_enabled"
                            );
                            formData.set(
                              "blastrRelayEnabled",
                              checked ? "true" : "false"
                            );
                            blastrFetcher.submit(formData, { method: "post" });
                          }}
                          disabled={blastrFetcher.state === "submitting"}
                        />
                        <Label
                          htmlFor="blastr-relay-enabled"
                          className="cursor-pointer text-sm font-normal"
                        >
                          Use SFS Blastr relay
                        </Label>
                      </div>
                    ) : null}
                    {isBlastr && canShowBlastrPolicyModal ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => setBlastrPolicyModalOpen(true)}
                      >
                        <Settings2
                          className={`mr-2 ${INLINE_ICON_SIZE_CLASS}`}
                        />
                        Relay policy
                      </Button>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-sm">
                    {mr.enabled ? (
                      <span className="text-success">Enabled</span>
                    ) : (
                      <span className="text-muted-foreground">Disabled</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit(e);
          }}
          className="space-y-4"
        >
          <div className="text-sm font-medium">
            SmartFlow app relay list
            {watchedSource === "nip65_profile" ? (
              <span className="text-muted-foreground ml-2 font-normal">
                (inactive — edit anytime; switch above to use for publishing)
              </span>
            ) : null}
          </div>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start space-x-2">
                <div className="flex-1">
                  <Input
                    id={`relay-${index}`}
                    {...form.register(`relays.${index}`)}
                    placeholder="wss://relay.damus.io"
                    disabled={isSubmitting}
                    onChange={(e) => {
                      // Remove spaces from relay URLs
                      const value = e.target.value.replace(/\s/g, "");
                      form.setValue(`relays.${index}`, value, {
                        shouldValidate: true,
                      });
                    }}
                    className={
                      form.formState.errors.relays?.[index]
                        ? "border-destructive"
                        : ""
                    }
                  />
                  {(() => {
                    const relayValue = watchedRelays[index] ?? "";
                    const ack = relayAcks[relayValue];
                    return relayValue ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        Last ACK: {formatAck(ack)}
                      </p>
                    ) : null;
                  })()}
                  {form.formState.errors.relays?.[index] ? (
                    <p className="text-destructive mt-1 text-sm">
                      {form.formState.errors.relays[index].message}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={() => remove(index)}
                  disabled={isSubmitting || fields.length <= 1}
                >
                  <X className={INLINE_ICON_SIZE_CLASS} />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => append("")}
              disabled={isSubmitting}
              className="w-full"
            >
              <Plus className={`mr-2 ${INLINE_ICON_SIZE_CLASS}`} />
              Add Relay
            </Button>
          </div>

          {form.formState.errors.relays ? (
            <p className="text-destructive text-sm">
              {form.formState.errors.relays.message}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={isSubmitting || !hasChanged || !form.formState.isValid}
            className="w-full"
          >
            {isSubmitting ? "Saving..." : "Save Relays"}
          </Button>

          {fetcher.data?.success ? (
            <p className="text-success text-sm">Relays updated successfully!</p>
          ) : null}
          {fetcher.data?.error ? (
            <p className="text-destructive text-sm">{fetcher.data.error}</p>
          ) : null}
        </form>

        {canShowBlastrPolicyModal ? (
          <Dialog
            open={blastrPolicyModalOpen}
            onOpenChange={setBlastrPolicyModalOpen}
          >
            <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
              <DialogHeader>
                <DialogTitle>SFS Blastr relay policy</DialogTitle>
                <DialogDescription>
                  Choose which relays Blastr fans out to. Blacklist = all system
                  relays except blocked; whitelist = only allowed relays.
                </DialogDescription>
              </DialogHeader>
              <BlastrPolicySettings
                policy={blastrPolicy}
                relays={blastrPolicyRelays}
                systemRelays={blastrSystemRelays}
                asModalContent
              />
            </DialogContent>
          </Dialog>
        ) : null}
      </CardContent>
    </Card>
  );
}
