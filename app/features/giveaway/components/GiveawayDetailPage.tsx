import { useFetcher, Link, useRouteLoaderData } from "@remix-run/react";
import { useState, useEffect, useMemo } from "react";
import { toast } from "react-hot-toast";

import ZapButton from "~/components/dashboard/ZapButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { getNostrClientUrlsFromUser } from "~/lib/nostr-client-urls";

import type { GiveawayWinnerEntry } from "../types";

function WinnerNpubRow({
  npub,
  displayName,
  picture,
  onCopy,
  profileUrl,
}: {
  npub: string;
  displayName?: string | null;
  picture?: string | null;
  onCopy?: () => void;
  profileUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(npub);
      setCopied(true);
      toast.success("Copied npub");
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };
  const trimmedName = displayName?.trim() ?? "";
  const primaryLabel =
    trimmedName !== ""
      ? trimmedName
      : npub.length > 24
        ? `${npub.slice(0, 20)}…${npub.slice(-8)}`
        : npub;
  const showNpubSecondary = Boolean(displayName?.trim());
  return (
    <div className="flex flex-wrap items-center gap-2">
      {picture ? (
        <img
          src={picture}
          alt=""
          className="size-8 shrink-0 rounded-full object-cover"
          width={32}
          height={32}
        />
      ) : (
        <div
          className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium"
          aria-hidden
        >
          {(displayName?.trim() ?? "").slice(0, 1).toUpperCase() || "?"}
        </div>
      )}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span
          className="text-foreground truncate text-sm font-medium"
          title={showNpubSecondary ? npub : undefined}
        >
          {primaryLabel}
        </span>
        {showNpubSecondary ? (
          <span
            className="text-muted-foreground truncate font-mono text-xs"
            title={npub}
          >
            {npub.length > 24 ? `${npub.slice(0, 12)}…${npub.slice(-8)}` : npub}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => {
            void handleCopy();
          }}
          className="text-muted-foreground hover:text-foreground shrink-0 text-xs"
          aria-label="Copy npub"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary shrink-0 text-xs"
        >
          Profile
        </a>
      </div>
    </div>
  );
}

const BATCH_ZAP_STORAGE_KEY = "giveaway_batch_zap";

function getMarkedZapped(giveawayId: string): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(
      `${BATCH_ZAP_STORAGE_KEY}:${giveawayId}`
    );
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

function setMarkedZapped(giveawayId: string, npub: string, value: boolean) {
  if (typeof window === "undefined") return;
  const prev = getMarkedZapped(giveawayId);
  sessionStorage.setItem(
    `${BATCH_ZAP_STORAGE_KEY}:${giveawayId}`,
    JSON.stringify({ ...prev, [npub]: value })
  );
}

type GiveawayStatus =
  | "DRAFT"
  | "PREVIEWED"
  | "LOCKED"
  | "PAID_OUT"
  | "CANCELLED";

export interface WinnerProfileDisplay {
  displayName: string | null;
  picture: string | null;
}

interface GiveawayDetailPageProps {
  giveaway: {
    id: string;
    name?: string | null;
    status: GiveawayStatus;
    statusLabel?: string;
    scopeSummaryLabel?: string;
    scopeType: string;
    winnerCount: number;
    winnerSnapshot: GiveawayWinnerEntry[] | null;
    lockedAt: string | null;
    createdAt: string;
    scopeReference?: Record<string, unknown>;
    engagementTypes?: string[];
    selectionMode?: string;
    engagementWeights?: Record<string, number> | null;
    filters?: Record<string, unknown> | null;
  };
  winnerProfiles?: Record<string, WinnerProfileDisplay>;
  canUsePresets?: boolean;
}

const ENGAGEMENT_OPTIONS = ["REACTION", "REPOST", "COMMENT", "ZAP"] as const;

/* eslint-disable sonarjs/cognitive-complexity -- detail page has many fetchers and states */
export function GiveawayDetailPage({
  giveaway,
  winnerProfiles = {},
  canUsePresets = false,
}: GiveawayDetailPageProps) {
  const rootData = useRouteLoaderData("root") as
    | {
        user?: {
          preferredNostrClient?: string;
          customNostrClientBaseUrl?: string | null;
        } | null;
      }
    | undefined;
  const nostrUrls = useMemo(
    () => getNostrClientUrlsFromUser(rootData?.user),
    [rootData?.user]
  );
  const previewFetcher = useFetcher<{
    winners?: GiveawayWinnerEntry[];
    error?: string;
  }>();
  const lockFetcher = useFetcher<{ success?: boolean; error?: string }>();
  const cancelFetcher = useFetcher<{ success?: boolean; error?: string }>();
  const deleteFetcher = useFetcher<{ success?: boolean; error?: string }>();
  const paidFetcher = useFetcher<{ success?: boolean; error?: string }>();
  const updateFetcher = useFetcher<{ success?: boolean; error?: string }>();
  const [showEdit, setShowEdit] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Toasts for action results
  useEffect(() => {
    if (previewFetcher.state !== "idle" || !previewFetcher.data) return;
    if (previewFetcher.data.error) {
      toast.error(previewFetcher.data.error);
    } else if (previewFetcher.data.winners != null) {
      toast.success("Winners previewed");
    }
  }, [previewFetcher.state, previewFetcher.data]);
  useEffect(() => {
    if (lockFetcher.state !== "idle" || !lockFetcher.data) return;
    if (
      typeof lockFetcher.data === "object" &&
      lockFetcher.data !== null && // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- fetcher.data type is generic
      "error" in lockFetcher.data &&
      lockFetcher.data.error
    ) {
      toast.error(lockFetcher.data.error);
    }
  }, [lockFetcher.state, lockFetcher.data]);
  useEffect(() => {
    if (cancelFetcher.state !== "idle" || !cancelFetcher.data) return;
    if (
      typeof cancelFetcher.data === "object" &&
      cancelFetcher.data !== null && // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- fetcher.data type is generic
      "error" in cancelFetcher.data &&
      cancelFetcher.data.error
    ) {
      toast.error(cancelFetcher.data.error);
      queueMicrotask(() => setShowCancelConfirm(false));
    }
  }, [cancelFetcher.state, cancelFetcher.data]);
  useEffect(() => {
    if (deleteFetcher.state !== "idle" || !deleteFetcher.data) return;
    if (
      typeof deleteFetcher.data === "object" &&
      deleteFetcher.data !== null && // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- fetcher.data type is generic
      "error" in deleteFetcher.data &&
      deleteFetcher.data.error
    ) {
      toast.error(deleteFetcher.data.error);
      queueMicrotask(() => setShowDeleteConfirm(false));
    }
  }, [deleteFetcher.state, deleteFetcher.data]);
  useEffect(() => {
    if (paidFetcher.state !== "idle" || !paidFetcher.data) return;
    if (
      typeof paidFetcher.data === "object" &&
      paidFetcher.data !== null && // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- fetcher.data type is generic
      "error" in paidFetcher.data &&
      paidFetcher.data.error
    ) {
      toast.error(paidFetcher.data.error);
    }
  }, [paidFetcher.state, paidFetcher.data]);
  useEffect(() => {
    if (updateFetcher.state !== "idle" || !updateFetcher.data) return;
    if (updateFetcher.data.error) toast.error(updateFetcher.data.error);
    else if (updateFetcher.data.success) toast.success("Configuration saved");
  }, [updateFetcher.state, updateFetcher.data]);

  const winners =
    (previewFetcher.data?.winners?.length
      ? previewFetcher.data.winners
      : giveaway.winnerSnapshot) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/dashboard/giveaway"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Back to Giveaways
        </Link>
      </div>

      <div className="border-border bg-card rounded-lg border p-4">
        <h1 className="text-foreground mb-2 text-xl font-bold">
          {giveaway.name ?? `Giveaway ${giveaway.id.slice(0, 8)}`}
        </h1>
        <p className="text-muted-foreground text-sm">
          {giveaway.scopeSummaryLabel ?? giveaway.scopeType} ·{" "}
          {giveaway.winnerCount} winner
          {giveaway.winnerCount !== 1 ? "s" : ""} ·{" "}
          {giveaway.statusLabel ?? giveaway.status}
        </p>
      </div>

      {giveaway.status === "CANCELLED" ? (
        <p className="text-muted-foreground">This giveaway was cancelled.</p>
      ) : null}

      {giveaway.status === "DRAFT" ||
      giveaway.status === "PREVIEWED" ||
      giveaway.status === "CANCELLED" ? (
        <div className="border-border border-t pt-4">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-destructive hover:text-destructive/90 text-sm underline"
          >
            Delete giveaway
          </button>
          <AlertDialog
            open={showDeleteConfirm}
            onOpenChange={setShowDeleteConfirm}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete giveaway?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove this giveaway. This cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <deleteFetcher.Form method="post">
                  <input type="hidden" name="intent" value="delete" />
                  <AlertDialogAction
                    type="submit"
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={deleteFetcher.state !== "idle"}
                  >
                    {deleteFetcher.state !== "idle"
                      ? "Deleting…"
                      : "Delete giveaway"}
                  </AlertDialogAction>
                </deleteFetcher.Form>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : null}

      {giveaway.status === "DRAFT" || giveaway.status === "PREVIEWED" ? (
        <div className="space-y-4">
          {giveaway.scopeSummaryLabel != null ||
          giveaway.engagementTypes != null ? (
            <div className="border-border bg-muted/20 rounded-lg border p-4">
              <h2 className="text-foreground mb-2 text-sm font-semibold">
                Configuration
              </h2>
              <ul className="text-muted-foreground space-y-1 text-sm">
                {giveaway.scopeSummaryLabel != null ? (
                  <li>
                    <span className="text-foreground font-medium">Scope:</span>{" "}
                    {giveaway.scopeSummaryLabel}
                  </li>
                ) : null}
                {Array.isArray(giveaway.engagementTypes) &&
                giveaway.engagementTypes.length > 0 ? (
                  <li>
                    <span className="text-foreground font-medium">
                      Engagement:
                    </span>{" "}
                    {giveaway.engagementTypes.join(", ").toLowerCase()}
                  </li>
                ) : null}
                <li>
                  <span className="text-foreground font-medium">Winners:</span>{" "}
                  {giveaway.winnerCount} ·{" "}
                  {giveaway.selectionMode === "WEIGHTED_BY_ENGAGEMENT"
                    ? "weighted by engagement"
                    : "unique user"}
                </li>
                {giveaway.filters &&
                typeof giveaway.filters === "object" &&
                (giveaway.filters["excludeMuted"] ||
                  giveaway.filters["excludeBlocked"] ||
                  giveaway.filters["excludeLowTrust"] ||
                  giveaway.filters["excludeNonFollowers"]) ? (
                  <li>
                    <span className="text-foreground font-medium">
                      Filter out:
                    </span>{" "}
                    {[
                      giveaway.filters["excludeMuted"] && "Muted",
                      giveaway.filters["excludeBlocked"] && "Blacklisted",
                      giveaway.filters["excludeLowTrust"] && "Low Trust",
                      giveaway.filters["excludeNonFollowers"] &&
                        "Non-followers",
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
          {giveaway.status === "DRAFT" &&
          (giveaway.engagementTypes != null ||
            giveaway.scopeSummaryLabel != null) ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowEdit((s) => !s)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                {showEdit ? "Hide edit" : "Edit configuration"}
              </button>
              {showEdit ? (
                <updateFetcher.Form
                  method="post"
                  className="border-border bg-muted/20 flex flex-col gap-3 rounded-lg border p-4"
                >
                  <input type="hidden" name="intent" value="update" />
                  <div>
                    <label
                      htmlFor="edit-name"
                      className="text-muted-foreground mb-1 block text-sm"
                    >
                      Giveaway name
                    </label>
                    <input
                      id="edit-name"
                      name="name"
                      type="text"
                      defaultValue={giveaway.name ?? ""}
                      placeholder="Optional name"
                      className="border-border bg-background w-full max-w-sm rounded border px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-winnerCount"
                      className="text-muted-foreground mb-1 block text-sm"
                    >
                      Winner count
                    </label>
                    <input
                      id="edit-winnerCount"
                      name="winnerCount"
                      type="number"
                      min={1}
                      max={50}
                      defaultValue={giveaway.winnerCount}
                      className="border-border bg-background w-20 rounded border px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <span className="text-muted-foreground mb-1 block text-sm">
                      Engagement types
                    </span>
                    <div className="flex flex-wrap gap-3">
                      {ENGAGEMENT_OPTIONS.map((opt) => (
                        <label
                          key={opt}
                          className="text-foreground flex items-center gap-1.5 text-sm"
                        >
                          <input
                            type="checkbox"
                            name="engagementTypes"
                            value={opt}
                            defaultChecked={
                              Array.isArray(giveaway.engagementTypes)
                                ? giveaway.engagementTypes.includes(opt)
                                : undefined
                            }
                          />
                          {opt.charAt(0) + opt.slice(1).toLowerCase()}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="edit-selectionMode"
                      className="text-muted-foreground mb-1 block text-sm"
                    >
                      Selection mode
                    </label>
                    <select
                      id="edit-selectionMode"
                      name="selectionMode"
                      className="border-border bg-background rounded border px-2 py-1 text-sm"
                      defaultValue={giveaway.selectionMode ?? "UNIQUE_USER"}
                    >
                      <option value="UNIQUE_USER">Unique user</option>
                      <option value="WEIGHTED_BY_ENGAGEMENT">
                        Weighted by engagement
                      </option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="border-border w-fit rounded-md border px-3 py-1.5 text-sm"
                    disabled={updateFetcher.state !== "idle"}
                  >
                    {updateFetcher.state !== "idle" ? "Saving…" : "Save"}
                  </button>
                  {updateFetcher.data?.error ? (
                    <p className="text-destructive text-sm">
                      {updateFetcher.data.error}
                    </p>
                  ) : null}
                </updateFetcher.Form>
              ) : null}
            </div>
          ) : null}
          {canUsePresets ? <SavePresetForm /> : null}
          {giveaway.status === "DRAFT" ? (
            <previewFetcher.Form method="post">
              <input type="hidden" name="intent" value="preview" />
              <button
                type="submit"
                className="bg-primary text-primary-foreground rounded-md px-4 py-2"
                disabled={previewFetcher.state !== "idle"}
              >
                {previewFetcher.state !== "idle"
                  ? "Loading…"
                  : "Preview winners"}
              </button>
            </previewFetcher.Form>
          ) : null}

          {previewFetcher.data?.error || lockFetcher.data?.error ? (
            <p className="text-destructive text-sm">
              {previewFetcher.data?.error ?? lockFetcher.data?.error}
            </p>
          ) : null}

          {giveaway.status === "PREVIEWED" ? (
            <>
              <previewFetcher.Form method="post">
                <input type="hidden" name="intent" value="reroll" />
                <button
                  type="submit"
                  className="border-border mr-2 rounded-md border px-4 py-2"
                  disabled={previewFetcher.state !== "idle"}
                >
                  Reroll
                </button>
              </previewFetcher.Form>
              <lockFetcher.Form method="post">
                <input type="hidden" name="intent" value="lock" />
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground mr-2 rounded-md px-4 py-2"
                  disabled={lockFetcher.state !== "idle"}
                >
                  Lock winners
                </button>
              </lockFetcher.Form>
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                className="text-destructive border-border rounded-md border px-4 py-2"
              >
                Cancel giveaway
              </button>
              <AlertDialog
                open={showCancelConfirm}
                onOpenChange={setShowCancelConfirm}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel giveaway?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This cannot be undone. The giveaway will be marked
                      cancelled.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <cancelFetcher.Form method="post">
                      <input type="hidden" name="intent" value="cancel" />
                      <AlertDialogAction
                        type="submit"
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={cancelFetcher.state !== "idle"}
                      >
                        {cancelFetcher.state !== "idle"
                          ? "Cancelling…"
                          : "Cancel giveaway"}
                      </AlertDialogAction>
                    </cancelFetcher.Form>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : null}

          {winners.length > 0 ? (
            <div className="border-border rounded-lg border p-4">
              <h2 className="text-foreground mb-3 font-semibold">
                Selected winners ({winners.length})
              </h2>
              <ul className="space-y-2">
                {winners.map((w, i) => (
                  <li
                    key={w.pubkey}
                    className="border-border bg-muted/30 flex flex-wrap items-center justify-between gap-2 rounded border p-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground text-sm">
                        {i + 1}.
                      </span>
                      <WinnerNpubRow
                        npub={w.npub}
                        displayName={winnerProfiles[w.pubkey]?.displayName}
                        picture={winnerProfiles[w.pubkey]?.picture}
                        profileUrl={nostrUrls.profileUrl(w.npub)}
                      />
                    </div>
                    {giveaway.status === "PREVIEWED" ? (
                      <ExcludeWinnerForm
                        giveawayId={giveaway.id}
                        winnerPubkey={w.pubkey}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {giveaway.status === "LOCKED" ? (
        <BatchZapFlow
          giveawayId={giveaway.id}
          winners={winners}
          winnerProfiles={winnerProfiles}
          lockedAt={giveaway.lockedAt}
          paidFetcher={paidFetcher}
          getProfileUrl={nostrUrls.profileUrl}
        />
      ) : null}

      {giveaway.status === "PAID_OUT" ? (
        <div className="border-border rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">Giveaway completed.</p>
          <ul className="text-foreground mt-2 space-y-1 text-sm">
            {winners.map((w, i) => (
              <li key={w.pubkey} className="flex items-center gap-2">
                <span className="text-muted-foreground">{i + 1}.</span>
                <WinnerNpubRow
                  npub={w.npub}
                  displayName={winnerProfiles[w.pubkey]?.displayName}
                  picture={winnerProfiles[w.pubkey]?.picture}
                  profileUrl={nostrUrls.profileUrl(w.npub)}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SavePresetForm() {
  const fetcher = useFetcher();
  return (
    <fetcher.Form method="post" className="flex items-center gap-2">
      <input type="hidden" name="intent" value="savePreset" />
      <label htmlFor="presetName" className="text-muted-foreground text-sm">
        Save as preset:
      </label>
      <input
        id="presetName"
        name="presetName"
        type="text"
        placeholder="Preset name"
        className="border-border bg-background rounded border px-2 py-1 text-sm"
      />
      <button
        type="submit"
        className="border-border rounded-md border px-3 py-1 text-sm"
        disabled={fetcher.state !== "idle"}
      >
        Save
      </button>
    </fetcher.Form>
  );
}

function BatchZapFlow({
  giveawayId,
  winners,
  winnerProfiles,
  lockedAt,
  paidFetcher,
  getProfileUrl,
}: {
  giveawayId: string;
  winners: GiveawayWinnerEntry[];
  winnerProfiles: Record<string, WinnerProfileDisplay>;
  lockedAt: string | null;
  paidFetcher: ReturnType<typeof useFetcher>;
  getProfileUrl: (npub: string) => string;
}) {
  const [marked, setMarked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMarked(getMarkedZapped(giveawayId));
  }, [giveawayId]);

  const markedCount = Object.values(marked).filter(Boolean).length;

  const handleMarkZapped = (npub: string) => {
    setMarkedZapped(giveawayId, npub, true);
    setMarked((prev) => ({ ...prev, [npub]: true }));
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Locked at {lockedAt ? new Date(lockedAt).toLocaleString() : ""}. Zap
        each winner, then mark as paid out when done.
      </p>
      {winners.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          {markedCount}/{winners.length} marked zapped
        </p>
      ) : null}
      <ul className="border-border divide-border divide-y rounded-lg border">
        {winners.map((w) => (
          <li
            key={w.pubkey}
            className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap"
          >
            <div className="min-w-0 flex-1">
              <WinnerNpubRow
                npub={w.npub}
                displayName={winnerProfiles[w.pubkey]?.displayName}
                picture={winnerProfiles[w.pubkey]?.picture}
                profileUrl={getProfileUrl(w.npub)}
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ZapButton
                npub={w.npub}
                amountSats={w.satsPerWinner}
                size="sm"
                onZapped={() => {
                  setMarkedZapped(giveawayId, w.npub, true);
                  setMarked((prev) => ({ ...prev, [w.npub]: true }));
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleMarkZapped(w.npub)}
                aria-label="Mark as zapped"
              >
                {marked[w.npub] ? "Zapped ✓" : "Mark zapped"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <paidFetcher.Form method="post">
        <input type="hidden" name="intent" value="markPaidOut" />
        <Button type="submit" disabled={paidFetcher.state !== "idle"}>
          Mark as paid out
        </Button>
      </paidFetcher.Form>
    </div>
  );
}
/* eslint-enable sonarjs/cognitive-complexity */

function ExcludeWinnerForm({
  giveawayId: _giveawayId,
  winnerPubkey,
}: {
  giveawayId: string;
  winnerPubkey: string;
}) {
  const fetcher = useFetcher();
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="exclude" />
      <input type="hidden" name="winnerPubkey" value={winnerPubkey} />
      <button
        type="submit"
        className="text-muted-foreground hover:text-destructive text-xs"
        disabled={fetcher.state !== "idle"}
      >
        Exclude
      </button>
    </fetcher.Form>
  );
}
