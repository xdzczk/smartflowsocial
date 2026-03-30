import { useFetcher, useRevalidator } from "@remix-run/react";
import { Plus, Settings2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "react-hot-toast";
import type { z } from "zod";

import { BlastrPolicySettings } from "~/components/settings/BlastrPolicySettings";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type {
  Nip65ProfileRelayEntry,
  Nip65RelayScope,
} from "~/features/relays/nip65-relay-entry";
import { ProviderSelectionSection } from "~/features/settings/components/patterns";
import { publishNip65RelayListToNostr } from "~/features/settings/publish-nip65-relay-list.client";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";
import { updateRelaysClientSchema } from "~/lib/validation";
import { useZodFieldArray } from "~/lib/validation/hooks/useZodFieldArray";
import { relayUrlSchema } from "~/lib/validation/schemas/settings.schemas";
import {
  useZodForm,
  formDataToFormData,
} from "~/lib/validation/utils.client-safe";

type PublishRelaySource = "app" | "nip65_profile";

const DEFAULT_PROFILE_ROW: Nip65ProfileRelayEntry = {
  url: "",
  scope: "both",
};

type ProfileRowState = Nip65ProfileRelayEntry & { clientId: string };

function newProfileRowClientId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function profileEntryToRowState(
  entry: Nip65ProfileRelayEntry
): ProfileRowState {
  return { ...entry, clientId: newProfileRowClientId() };
}

function emptyProfileRowState(): ProfileRowState {
  return { ...DEFAULT_PROFILE_ROW, clientId: newProfileRowClientId() };
}

interface RelaysSettingsProps {
  relays: string[];
  publishRelaySource: PublishRelaySource;
  /** NIP-65 `r` rows from kind 10002 (seed for profile editor). */
  profileRelayEntries: Nip65ProfileRelayEntry[];
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
  profileRelayEntries,
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
  const [publishingProfile, setPublishingProfile] = useState(false);
  const fetcher = useFetcher<FetcherData>();
  const blastrFetcher = useFetcher<FetcherData>();
  const revalidator = useRevalidator();

  const profileSeedKey = JSON.stringify(
    profileRelayEntries.map((e) => ({ url: e.url, scope: e.scope }))
  );
  const [profileRows, setProfileRows] = useState<ProfileRowState[]>(() =>
    profileRelayEntries.length > 0
      ? profileRelayEntries.map((e) => profileEntryToRowState(e))
      : [emptyProfileRowState()]
  );

  useEffect(() => {
    setProfileRows(
      profileRelayEntries.length > 0
        ? profileRelayEntries.map((e) => profileEntryToRowState(e))
        : [emptyProfileRowState()]
    );
  }, [profileSeedKey]); // eslint-disable-line react-hooks/exhaustive-deps -- profileSeedKey encodes entries

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

  const tabValue = watchedSource === "nip65_profile" ? "profile" : "app";

  const setTabValue = useCallback(
    (v: string) => {
      form.setValue(
        "publishRelaySource",
        v === "profile" ? "nip65_profile" : "app",
        { shouldValidate: true }
      );
    },
    [form]
  );

  const onSubmit = form.handleSubmit((data) => {
    const filteredRelays = data.relays.filter((relay: string) => relay.trim());
    if (filteredRelays.length === 0) {
      form.setError("relays", {
        type: "manual",
        message: "At least one relay is required",
      });
      return;
    }

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

  const addProfileRow = () =>
    setProfileRows((r) => [...r, emptyProfileRowState()]);
  const removeProfileRow = (index: number) =>
    setProfileRows((r) =>
      r.length <= 1 ? r : r.filter((_, i) => i !== index)
    );
  const setProfileRowUrl = (index: number, value: string) =>
    setProfileRows((r) => {
      const next = [...r];
      const row = next[index];
      if (!row) return r;
      next[index] = { ...row, url: value.replace(/\s/g, "") };
      return next;
    });
  const setProfileRowScope = (index: number, scope: Nip65RelayScope) =>
    setProfileRows((r) => {
      const next = [...r];
      const row = next[index];
      if (!row) return r;
      next[index] = { ...row, scope };
      return next;
    });

  const handlePublishProfileRelays = async () => {
    const entries = profileRows.filter((row) => row.url.trim());
    if (entries.length === 0) {
      toast.error("Add at least one relay before publishing.");
      return;
    }
    for (const row of entries) {
      try {
        relayUrlSchema.parse(row.url.trim());
      } catch {
        toast.error(`Invalid relay URL: ${row.url}`);
        return;
      }
    }

    setPublishingProfile(true);
    try {
      await publishNip65RelayListToNostr(
        entries.map((e) => ({ url: e.url.trim(), scope: e.scope }))
      );
      toast.success("Relay list published to Nostr.");
      revalidator.revalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to publish");
    } finally {
      setPublishingProfile(false);
    }
  };

  return (
    <ProviderSelectionSection
      title="Nostr relays"
      description="SFS Blastr is optional fan-out. Pick either your Nostr profile relay list (NIP-65) or the SmartFlow app list — only one is used when you publish."
    >
      <div className="space-y-6">
        {managedRelays.length > 0 ? (
          <div className="space-y-3">
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
                            const fd = new FormData();
                            fd.set("_action", "update_blastr_relay_enabled");
                            fd.set(
                              "blastrRelayEnabled",
                              checked ? "true" : "false"
                            );
                            blastrFetcher.submit(fd, { method: "post" });
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
          <Tabs value={tabValue} onValueChange={setTabValue} className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1">
              <TabsTrigger value="profile" className="text-center">
                Nostr profile relays
              </TabsTrigger>
              <TabsTrigger value="app" className="text-center">
                SmartFlow app relays
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" forceMount className="mt-4">
              <div className={cn(tabValue !== "profile" && "hidden")}>
                <p className="text-muted-foreground mb-4 text-sm">
                  Edit relays here, then sign with your connected Nostr signer
                  to publish kind 10002. Choose read, write, or both per relay
                  (NIP-65); both is stored as an unmarked{" "}
                  <code className="text-xs">r</code> tag.
                </p>
                <div className="space-y-2">
                  {profileRows.map((row, index) => (
                    <div
                      key={row.clientId}
                      className="flex flex-col gap-2 sm:flex-row sm:items-start"
                    >
                      <div className="min-w-0 flex-1">
                        <Input
                          id={`profile-relay-${index}`}
                          value={row.url}
                          onChange={(e) =>
                            setProfileRowUrl(index, e.target.value)
                          }
                          placeholder="wss://relay.damus.io"
                          disabled={publishingProfile || isSubmitting}
                          className="font-mono text-sm"
                        />
                        {row.url.trim() ? (
                          <p className="text-muted-foreground mt-1 text-xs">
                            Last ACK: {formatAck(relayAcks[row.url.trim()])}
                          </p>
                        ) : null}
                      </div>
                      <Select
                        value={row.scope}
                        onValueChange={(v) =>
                          setProfileRowScope(index, v as Nip65RelayScope)
                        }
                        disabled={publishingProfile || isSubmitting}
                      >
                        <SelectTrigger className="h-10 w-full font-normal sm:w-[11rem]">
                          <SelectValue placeholder="Scope" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="both">Read & write</SelectItem>
                          <SelectItem value="read">Read only</SelectItem>
                          <SelectItem value="write">Write only</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => removeProfileRow(index)}
                        disabled={
                          publishingProfile ||
                          isSubmitting ||
                          profileRows.length <= 1
                        }
                        className="shrink-0 sm:mt-0"
                      >
                        <X className={INLINE_ICON_SIZE_CLASS} />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addProfileRow}
                    disabled={publishingProfile || isSubmitting}
                    className="w-full"
                  >
                    <Plus className={`mr-2 ${INLINE_ICON_SIZE_CLASS}`} />
                    Add relay
                  </Button>
                </div>
                <Button
                  type="button"
                  className="mt-4 w-full"
                  disabled={publishingProfile || isSubmitting}
                  onClick={() => void handlePublishProfileRelays()}
                >
                  {publishingProfile
                    ? "Signing & publishing…"
                    : "Sign & publish relay list to Nostr"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="app" forceMount className="mt-4">
              <div className={cn(tabValue !== "app" && "hidden")}>
                <p className="text-muted-foreground mb-4 text-sm">
                  Relays stored in SmartFlow. Defaults apply until you change
                  and save them.
                </p>
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
                  <p className="text-destructive mt-2 text-sm">
                    {form.formState.errors.relays.message}
                  </p>
                ) : null}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="submit"
              disabled={isSubmitting || !hasChanged || !form.formState.isValid}
              size="sm"
            >
              {isSubmitting ? "Saving…" : "Save relay preferences"}
            </Button>
          </div>

          {fetcher.data?.success ? (
            <p className="text-success text-sm">
              Relay preferences updated successfully.
            </p>
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
      </div>
    </ProviderSelectionSection>
  );
}
