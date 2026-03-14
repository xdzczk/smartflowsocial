import { useFetcher } from "@remix-run/react";
import { Plus, X } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

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
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import { updateRelaysClientSchema } from "~/lib/validation";
import { useZodFieldArray } from "~/lib/validation/hooks/useZodFieldArray";
import { relayUrlSchema } from "~/lib/validation/schemas/settings.schemas";
import {
  useZodForm,
  formDataToFormData,
} from "~/lib/validation/utils.client-safe";

interface RelaysSettingsProps {
  relays: string[];
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
  managedRelays,
  relayAcks,
  blastrRelayEnabled = true,
  canToggleBlastr = false,
}: RelaysSettingsProps) {
  const fetcher = useFetcher<FetcherData>();
  const blastrFetcher = useFetcher<FetcherData>();
  const form = useZodForm(updateRelaysClientSchema, {
    defaultValues: {
      relays: relays.length > 0 ? relays : [""],
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
  const hasChanged = JSON.stringify(watchedRelays) !== JSON.stringify(relays);

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
      { relays: filteredRelays.join("\n") },
      "update_relays"
    );

    fetcher.submit(formData, { method: "post" });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nostr Relays</CardTitle>
        <CardDescription>
          Manage your relay intent for publishing posts. Managed relays (like
          SmartFlowSocial fan-out) are shown separately.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
