import { useFetcher, useRevalidator } from "@remix-run/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "react-hot-toast";
import type { z } from "zod";

import { BlastrPolicySettings } from "~/components/settings/BlastrPolicySettings";
import {
  RelayDeliverySection,
  RelayListSection,
  RelaySourceSection,
} from "~/components/settings/relays-settings-sections";
import type { ProfileRowState } from "~/components/settings/relays-settings-types";
import { formatAck } from "~/components/settings/relays-settings-utils";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import type {
  Nip65ProfileRelayEntry,
  Nip65RelayScope,
} from "~/features/relays/nip65-relay-entry";
import { publishNip65RelayListToNostr } from "~/features/settings/publish-nip65-relay-list.client";
import { BRAND_NAME } from "~/lib/brand";
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

function normalizeProfileForCompare(
  rows: Array<{ url: string; scope: Nip65RelayScope }>
): string {
  const normalized = rows
    .filter((r) => r.url.trim())
    .map((r) => ({ url: r.url.trim(), scope: r.scope }))
    .sort(
      (a, b) => a.url.localeCompare(b.url) || a.scope.localeCompare(b.scope)
    );
  return JSON.stringify(normalized);
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
  /** When true, Blastr is locked because the plan excludes it (not “free”). */
  hasActiveSubscription?: boolean;
}

interface FetcherData {
  success?: boolean;
  error?: string;
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
  hasActiveSubscription = false,
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

  const profileDirty = useMemo(
    () =>
      normalizeProfileForCompare(profileRows) !==
      normalizeProfileForCompare(profileRelayEntries),
    [profileRows, profileRelayEntries]
  );

  const blastrRelay = managedRelays.find((m) => m.id === "blastr");
  const blastrAck = blastrRelay ? relayAcks[blastrRelay.relayUrl] : undefined;

  const blastrStatus = useMemo(() => {
    if (!blastrRelay) return null;
    if (!canToggleBlastr) {
      if (hasActiveSubscription) {
        return {
          badge: (
            <Badge variant="secondary" className="font-normal">
              Not included on your plan
            </Badge>
          ),
          lockCopy: "Upgrade to a plan that includes relay fan-out to unlock.",
        } as const;
      }
      return {
        badge: (
          <Badge variant="secondary" className="font-normal">
            Locked on Free plan
          </Badge>
        ),
        lockCopy: "Optional relay fan-out is available on paid plans.",
      } as const;
    }
    if (blastrRelay.enabled) {
      return {
        badge: (
          <Badge
            variant="default"
            className="bg-emerald-600 font-normal hover:bg-emerald-600"
          >
            Enabled
          </Badge>
        ),
        lockCopy: null,
      } as const;
    }
    return {
      badge: (
        <Badge variant="secondary" className="font-normal">
          Off
        </Badge>
      ),
      lockCopy: null,
    } as const;
  }, [blastrRelay, canToggleBlastr, hasActiveSubscription]);

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

  const publishSummaryLine =
    watchedSource === "nip65_profile"
      ? `${BRAND_NAME} is currently publishing with your Nostr profile relay list.`
      : `${BRAND_NAME} is currently publishing with your ${BRAND_NAME} app relay list.`;

  const profileValidEntries = profileRows.filter((r) => r.url.trim());
  const profileHasInvalidUrl = profileRows.some((row) => {
    if (!row.url.trim()) return false;
    try {
      relayUrlSchema.parse(row.url.trim());
      return false;
    } catch {
      return true;
    }
  });
  const canSignPublishProfile =
    profileDirty &&
    profileValidEntries.length > 0 &&
    !profileHasInvalidUrl &&
    !publishingProfile;

  const relayListDescription =
    watchedSource === "nip65_profile"
      ? "Edit the relay list that will be published to your Nostr profile."
      : `Edit the relay list ${BRAND_NAME} stores and uses for publishing from this app.`;

  return (
    <div className="space-y-6">
      <RelayDeliverySection
        blastrRelay={blastrRelay}
        blastrStatus={blastrStatus}
        blastrAckFormatted={formatAck(blastrAck)}
        canToggleBlastr={canToggleBlastr}
        blastrRelayEnabled={blastrRelayEnabled}
        canShowBlastrPolicyModal={!!canShowBlastrPolicyModal}
        onOpenPolicy={() => setBlastrPolicyModalOpen(true)}
        blastrFetcher={blastrFetcher}
        publishSummaryLine={publishSummaryLine}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit(e);
        }}
        className="space-y-6"
      >
        <RelaySourceSection
          tabValue={tabValue}
          watchedSource={watchedSource}
          onSelectProfile={() => setTabValue("profile")}
          onSelectApp={() => setTabValue("app")}
        />

        <RelayListSection
          relayListDescription={relayListDescription}
          tabValue={tabValue}
          onAddRelay={() =>
            tabValue === "profile" ? addProfileRow() : append("")
          }
          publishingProfile={publishingProfile}
          isSubmitting={isSubmitting}
          profileDirty={profileDirty}
          hasChanged={hasChanged}
          profileRows={profileRows}
          relayAcks={relayAcks}
          setProfileRowUrl={setProfileRowUrl}
          setProfileRowScope={setProfileRowScope}
          removeProfileRow={removeProfileRow}
          fields={fields}
          form={
            form as unknown as UseFormReturn<
              z.infer<typeof updateRelaysClientSchema>
            >
          }
          watchedRelays={watchedRelays}
          remove={remove}
          canSignPublishProfile={canSignPublishProfile}
          handlePublishProfileRelays={handlePublishProfileRelays}
          publishingState={publishingProfile}
          fetcher={fetcher}
        />
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
  );
}
