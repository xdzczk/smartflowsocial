import type { FetcherWithComponents } from "@remix-run/react";
import { Link } from "@remix-run/react";
import { Check, Lock, Plus, Settings2, X } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import { Button } from "~/components/ui/button";
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
import type { Nip65RelayScope } from "~/features/relays/nip65-relay-entry";
import { SettingsSectionHeader } from "~/features/settings/components/patterns";
import { BRAND_NAME } from "~/lib/brand";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";
import type { updateRelaysClientSchema } from "~/lib/validation";

import type { ProfileRowState } from "./relays-settings-types";
import {
  formatAck,
  scopeLabel,
  settingsSubsectionClassName,
} from "./relays-settings-utils";

type BlastrStatus = {
  badge: React.ReactNode;
  lockCopy: string | null;
} | null;

interface RelayDeliverySectionProps {
  blastrRelay:
    | {
        id: string;
        relayUrl: string;
        enabled: boolean;
      }
    | undefined;
  blastrStatus: BlastrStatus;
  blastrAckFormatted: string;
  canToggleBlastr: boolean;
  blastrRelayEnabled: boolean;
  canShowBlastrPolicyModal: boolean;
  onOpenPolicy: () => void;
  blastrFetcher: FetcherWithComponents<{ success?: boolean; error?: string }>;
  publishSummaryLine: string;
}

export function RelayDeliverySection({
  blastrRelay,
  blastrStatus,
  blastrAckFormatted,
  canToggleBlastr,
  blastrRelayEnabled,
  canShowBlastrPolicyModal,
  onOpenPolicy,
  blastrFetcher,
  publishSummaryLine,
}: RelayDeliverySectionProps) {
  return (
    <section className={settingsSubsectionClassName()}>
      <SettingsSectionHeader
        title="Relay delivery"
        description="Optional infrastructure for how publishes are delivered."
      />
      {blastrRelay && blastrStatus ? (
        <div
          className={cn(
            "mt-4 rounded-xl border p-4",
            !canToggleBlastr
              ? "border-muted-foreground/25 bg-surface-hover/30"
              : "border-border bg-surface"
          )}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-text text-sm font-semibold">SFS Blastr</h3>
                {blastrStatus.badge}
                {!canToggleBlastr ? (
                  <Lock
                    className="text-text-secondary size-4 shrink-0"
                    aria-hidden
                  />
                ) : null}
              </div>
              <p className="text-text-secondary max-w-prose text-sm leading-relaxed">
                Optional {BRAND_NAME} relay fan-out for broader publish
                delivery.
                {!canToggleBlastr ? (
                  <> {blastrStatus.lockCopy}</>
                ) : (
                  <>
                    {" "}
                    When enabled, publishes may also fan out through the
                    {BRAND_NAME} relay.
                  </>
                )}
              </p>
              {!canToggleBlastr ? (
                <Button
                  variant="secondary"
                  size="sm"
                  asChild
                  className="mt-1 w-fit"
                >
                  <Link to="/plans">View plans</Link>
                </Button>
              ) : null}
              {canToggleBlastr && blastrRelay.enabled ? (
                <p className="text-text-secondary text-xs">
                  Last ACK: {blastrAckFormatted}
                </p>
              ) : null}
              {canToggleBlastr ? (
                <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex items-center gap-2">
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
                  {canShowBlastrPolicyModal ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onOpenPolicy}
                    >
                      <Settings2 className={`mr-2 ${INLINE_ICON_SIZE_CLASS}`} />
                      Relay policy
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="text-text-secondary font-mono text-xs break-all sm:max-w-[min(100%,20rem)] sm:text-right">
              {blastrRelay.relayUrl}
            </div>
          </div>
        </div>
      ) : null}
      <p className="text-text-secondary mt-4 border-t pt-3 text-sm leading-relaxed">
        {publishSummaryLine}
      </p>
    </section>
  );
}

interface RelaySourceSectionProps {
  tabValue: "profile" | "app";
  watchedSource: "app" | "nip65_profile";
  onSelectProfile: () => void;
  onSelectApp: () => void;
}

export function RelaySourceSection({
  tabValue,
  watchedSource,
  onSelectProfile,
  onSelectApp,
}: RelaySourceSectionProps) {
  return (
    <section className={settingsSubsectionClassName()}>
      <SettingsSectionHeader
        title="Relay source"
        description={`Choose which relay list ${BRAND_NAME} uses when publishing.`}
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          role="radio"
          aria-checked={tabValue === "profile"}
          onClick={onSelectProfile}
          className={cn(
            "flex flex-col rounded-lg border p-4 text-left transition-colors",
            tabValue === "profile"
              ? "border-brand bg-brand/5 ring-brand ring-offset-canvas ring-2 ring-offset-2"
              : "border-border/80 hover:bg-surface-hover/40"
          )}
        >
          <span className="flex items-center gap-2 font-medium">
            {tabValue === "profile" ? (
              <Check className="text-brand size-4 shrink-0" />
            ) : null}
            Nostr profile relays
          </span>
          <span className="text-text-secondary mt-2 text-sm leading-snug">
            Uses the relay list published on your Nostr profile.
          </span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={tabValue === "app"}
          onClick={onSelectApp}
          className={cn(
            "flex flex-col rounded-lg border p-4 text-left transition-colors",
            tabValue === "app"
              ? "border-brand bg-brand/5 ring-brand ring-offset-canvas ring-2 ring-offset-2"
              : "border-border/80 hover:bg-surface-hover/40"
          )}
        >
          <span className="flex items-center gap-2 font-medium">
            {tabValue === "app" ? (
              <Check className="text-brand size-4 shrink-0" />
            ) : null}
            {BRAND_NAME} app relays
          </span>
          <span className="text-text-secondary mt-2 text-sm leading-snug">
            Uses a relay list stored only in {BRAND_NAME} for publishing from
            this app.
          </span>
        </button>
      </div>
      <p className="text-text-secondary mt-4 text-sm leading-relaxed">
        Relay source and your {BRAND_NAME} app relay list are saved when you use{" "}
        <span className="text-text font-medium">
          Save {BRAND_NAME} preferences
        </span>{" "}
        below. Updating your Nostr profile relay list requires signing with{" "}
        <span className="text-text font-medium">
          Sign &amp; publish relay list to Nostr
        </span>{" "}
        when that source is selected.
      </p>
      <p className="text-text mt-2 text-sm font-medium">
        {watchedSource === "nip65_profile"
          ? `${BRAND_NAME} will publish using your Nostr profile relay list once it is published to your profile.`
          : `${BRAND_NAME} will publish using your ${BRAND_NAME} app relay list.`}
      </p>
    </section>
  );
}

type RelayForm = UseFormReturn<z.infer<typeof updateRelaysClientSchema>>;

interface RelayListSectionProps {
  relayListDescription: string;
  tabValue: "profile" | "app";
  onAddRelay: () => void;
  publishingProfile: boolean;
  isSubmitting: boolean;
  profileDirty: boolean;
  hasChanged: boolean;
  profileRows: ProfileRowState[];
  relayAcks: Record<
    string,
    { status: string; createdAt: string; receivedAt: string | null }
  >;
  setProfileRowUrl: (index: number, value: string) => void;
  setProfileRowScope: (index: number, scope: Nip65RelayScope) => void;
  removeProfileRow: (index: number) => void;
  fields: Array<{ id: string }>;
  form: RelayForm;
  watchedRelays: string[];
  remove: (index: number) => void;
  canSignPublishProfile: boolean;
  handlePublishProfileRelays: () => Promise<void>;
  publishingState: boolean;
  fetcher: FetcherWithComponents<{ success?: boolean; error?: string }>;
}

export function RelayListSection({
  relayListDescription,
  tabValue,
  onAddRelay,
  publishingProfile,
  isSubmitting,
  profileDirty,
  hasChanged,
  profileRows,
  relayAcks,
  setProfileRowUrl,
  setProfileRowScope,
  removeProfileRow,
  fields,
  form,
  watchedRelays,
  remove,
  canSignPublishProfile,
  handlePublishProfileRelays,
  publishingState,
  fetcher,
}: RelayListSectionProps) {
  return (
    <section className={settingsSubsectionClassName()}>
      <SettingsSectionHeader
        title="Relay list"
        description={relayListDescription}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddRelay}
            disabled={
              tabValue === "profile"
                ? publishingProfile || isSubmitting
                : isSubmitting
            }
          >
            <Plus className={`mr-1.5 ${INLINE_ICON_SIZE_CLASS}`} />
            Add relay
          </Button>
        }
      />

      <div className="mt-4 space-y-3">
        {tabValue === "profile" ? (
          <>
            <p className="text-text-secondary text-sm leading-relaxed">
              Update the relay list published on your Nostr profile. Changes
              require signing before they take effect on the network.
            </p>
            {profileDirty ? (
              <p className="text-warning dark:text-warning text-xs">
                Unpublished changes — sign and publish to update your profile
                relay list on Nostr.
              </p>
            ) : null}
            <div className="space-y-3">
              {profileRows.map((row, index) => (
                <div
                  key={row.clientId}
                  className="border-border/60 bg-canvas/50 rounded-lg border p-3"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Input
                        id={`profile-relay-${index}`}
                        value={row.url}
                        onChange={(e) =>
                          setProfileRowUrl(index, e.target.value)
                        }
                        placeholder="wss://relay.damus.io"
                        disabled={publishingProfile || isSubmitting}
                        className="border-border/80 bg-surface-hover/25 font-mono text-sm"
                      />
                      <div className="text-text-secondary flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {row.url.trim() ? (
                          <span>
                            Last ACK: {formatAck(relayAcks[row.url.trim()])}
                          </span>
                        ) : null}
                        <span>{scopeLabel(row.scope)}</span>
                        {profileDirty ? (
                          <span className="text-warning-text">
                            Pending publish
                          </span>
                        ) : (
                          <span>Profile relay</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                      <Select
                        value={row.scope}
                        onValueChange={(v) =>
                          setProfileRowScope(index, v as Nip65RelayScope)
                        }
                        disabled={publishingProfile || isSubmitting}
                      >
                        <SelectTrigger className="h-9 w-full font-normal lg:w-[11rem]">
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
                        className="h-9 w-9 shrink-0"
                        aria-label="Remove relay"
                      >
                        <X className={INLINE_ICON_SIZE_CLASS} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-text-secondary text-sm leading-relaxed">
              Relays are stored in {BRAND_NAME}. Save when you are ready to use
              this list for publishing (with this source selected).
            </p>
            {hasChanged ? (
              <p className="text-warning dark:text-warning text-xs">
                Unsaved changes to app relays or relay source.
              </p>
            ) : null}
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="border-border/60 bg-canvas/50 rounded-lg border p-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
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
                        className={cn(
                          "border-border/80 bg-surface-hover/25 font-mono text-sm",
                          form.formState.errors.relays?.[index]
                            ? "border-danger"
                            : ""
                        )}
                      />
                      <div className="text-text-secondary flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {(() => {
                          const relayValue = watchedRelays[index] ?? "";
                          const ack = relayAcks[relayValue];
                          return relayValue ? (
                            <span>Last ACK: {formatAck(ack)}</span>
                          ) : null;
                        })()}
                        <span>Stored in {BRAND_NAME}</span>
                      </div>
                      {form.formState.errors.relays?.[index] ? (
                        <p className="text-danger text-sm">
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
                      className="h-9 w-9 shrink-0 sm:mt-0"
                      aria-label="Remove relay"
                    >
                      <X className={INLINE_ICON_SIZE_CLASS} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {form.formState.errors.relays &&
            typeof form.formState.errors.relays.message === "string" ? (
              <p className="text-danger mt-2 text-sm">
                {form.formState.errors.relays.message}
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="border-border/60 mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-[1.25rem] text-xs">
          {tabValue === "profile" && profileDirty ? (
            <span className="text-warning dark:text-warning">
              Profile relay list not published to Nostr yet.
            </span>
          ) : null}
          {tabValue === "app" && hasChanged ? (
            <span className="text-warning dark:text-warning">
              Relay preferences not saved.
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-2">
          {tabValue === "profile" ? (
            <>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={
                  isSubmitting || !hasChanged || !form.formState.isValid
                }
              >
                {isSubmitting ? "Saving…" : `Save ${BRAND_NAME} preferences`}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!canSignPublishProfile || isSubmitting}
                onClick={() => void handlePublishProfileRelays()}
              >
                {publishingState
                  ? "Signing & publishing…"
                  : "Sign & publish relay list to Nostr"}
              </Button>
            </>
          ) : (
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !hasChanged || !form.formState.isValid}
            >
              {isSubmitting ? "Saving…" : "Save app relay list"}
            </Button>
          )}
        </div>
      </div>

      {fetcher.data?.success ? (
        <p className="text-success mt-3 text-sm">
          Relay preferences updated successfully.
        </p>
      ) : null}
      {fetcher.data?.error ? (
        <p className="text-danger mt-3 text-sm">{fetcher.data.error}</p>
      ) : null}
    </section>
  );
}
