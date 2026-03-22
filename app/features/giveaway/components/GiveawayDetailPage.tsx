import { Form, useFetcher, Link, useRouteLoaderData } from "@remix-run/react";
import { useState, useEffect, useMemo, useRef } from "react";
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

import { giveawayStatusPillClass } from "../giveaway-status-ui";
import type { GiveawayWinnerEntry } from "../types";

function budgetFromSnapshot(snap: GiveawayWinnerEntry[]): number {
  return snap.reduce((a, w) => a + (w.satsPerWinner ?? 0), 0);
}

function winnerEngagementBadges(w: GiveawayWinnerEntry): string[] {
  const kinds = new Set(w.qualifyingActions.map((a) => a.kind));
  const out: string[] = [];
  if (kinds.has(7)) out.push("Reaction");
  if (kinds.has(6)) out.push("Repost");
  if (kinds.has(1)) out.push("Comment");
  if (kinds.has(9735)) out.push("Zap");
  if (w.engagementType) out.push(String(w.engagementType));
  return out.length ? out : ["Participant"];
}

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

export interface GiveawayPayoutProgress {
  settledCount: number;
  totalWinners: number;
  budgetSats: number;
  settledSats: number;
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
    updatedAt?: string;
    engagementConfig?: unknown;
    payoutState?: Record<
      string,
      { status: string; updatedAt?: string; note?: string }
    >;
    payoutProgress?: GiveawayPayoutProgress | null;
    lastPreviewMeta?: unknown;
    rerollCount?: number;
    excludedPubkeys?: unknown;
    activityLog?: unknown;
    scopeReference?: Record<string, unknown>;
    engagementTypes?: string[];
    selectionMode?: string;
    engagementWeights?: Record<string, number> | null;
    filters?: Record<string, unknown> | null;
  };
  winnerProfiles?: Record<string, WinnerProfileDisplay>;
  canUsePresets?: boolean;
  maxWinnerCount?: number;
}

const ENGAGEMENT_OPTIONS = ["REACTION", "REPOST", "COMMENT", "ZAP"] as const;

/* eslint-disable sonarjs/cognitive-complexity -- detail page has many fetchers and states */
export function GiveawayDetailPage({
  giveaway,
  winnerProfiles = {},
  canUsePresets = false,
  maxWinnerCount = 50,
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
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  // Toasts for action results
  useEffect(() => {
    if (previewFetcher.state !== "idle" || !previewFetcher.data) return;
    if (previewFetcher.data.error) {
      toast.error(previewFetcher.data.error);
    } else if (previewFetcher.data.winners != null) {
      toast.success("Winners previewed");
    }
  }, [previewFetcher.state, previewFetcher.data]);
  const lockFetcherWasBusyRef = useRef(false);
  useEffect(() => {
    const busy =
      lockFetcher.state === "submitting" || lockFetcher.state === "loading";
    if (busy) lockFetcherWasBusyRef.current = true;
    if (lockFetcher.state !== "idle" || !lockFetcherWasBusyRef.current) return;
    lockFetcherWasBusyRef.current = false;
    const data = lockFetcher.data;
    const err =
      data && typeof data === "object" && "error" in data && data.error
        ? String(data.error)
        : undefined;
    if (err) {
      toast.error(err);
    } else {
      queueMicrotask(() => setShowLockConfirm(false));
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

  const previewMeta =
    giveaway.lastPreviewMeta && typeof giveaway.lastPreviewMeta === "object"
      ? (giveaway.lastPreviewMeta as {
          eligiblePoolSize?: number;
          computedAt?: string;
          selectionMode?: string;
        })
      : null;

  const activityEntries = Array.isArray(giveaway.activityLog)
    ? (giveaway.activityLog as Array<{
        at: string;
        type: string;
        payload?: Record<string, unknown>;
      }>)
    : [];

  const excludedList = Array.isArray(giveaway.excludedPubkeys)
    ? (giveaway.excludedPubkeys as string[])
    : [];

  const totalBudgetSats = budgetFromSnapshot(winners);

  const copyPublicSummary = async () => {
    const lines = [
      giveaway.name ?? `Giveaway ${giveaway.id.slice(0, 8)}`,
      giveaway.scopeSummaryLabel ?? "",
      `Winners: ${winners.length}`,
      `Sats (planned): ${totalBudgetSats.toLocaleString()}`,
      `Status: ${giveaway.statusLabel ?? giveaway.status}`,
      "Powered by SmartFlow Social",
    ];
    try {
      await navigator.clipboard.writeText(lines.filter(Boolean).join("\n"));
      toast.success("Summary copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const exportWinnersCsv = () => {
    const header = "index,npub,displayName,satsPerWinner,badges";
    const rows = winners.map((w, i) => {
      const name = winnerProfiles[w.pubkey]?.displayName ?? "";
      const badges = winnerEngagementBadges(w).join(";");
      return [
        i + 1,
        `"${w.npub.replace(/"/g, '""')}"`,
        `"${String(name).replace(/"/g, '""')}"`,
        w.satsPerWinner ?? "",
        `"${badges.replace(/"/g, '""')}"`,
      ].join(",");
    });
    const blob = new Blob([`${header}\n${rows.join("\n")}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `giveaway-${giveaway.id}-winners.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

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

      <div
        className={`rounded-lg border p-5 ${
          giveaway.status === "PREVIEWED"
            ? "border-blue-500/40 bg-blue-500/5"
            : giveaway.status === "LOCKED"
              ? "border-amber-500/40 bg-amber-500/5"
              : giveaway.status === "PAID_OUT"
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-border bg-card"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-foreground text-2xl font-bold tracking-tight">
              {giveaway.name ?? `Giveaway ${giveaway.id.slice(0, 8)}`}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {giveaway.status === "PREVIEWED"
                ? "Review the selection before locking. You can reroll or exclude winners."
                : giveaway.status === "LOCKED"
                  ? "Winners are fixed. Complete payouts, then mark the giveaway complete."
                  : giveaway.status === "PAID_OUT"
                    ? "Campaign complete — share your receipt below."
                    : "Configure and preview before you lock winners."}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 text-right text-xs">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${giveawayStatusPillClass(giveaway.status)}`}
            >
              {giveaway.statusLabel ?? giveaway.status}
            </span>
            <span className="text-muted-foreground">
              Updated{" "}
              {giveaway.updatedAt
                ? new Date(giveaway.updatedAt).toLocaleString()
                : "—"}
            </span>
          </div>
        </div>
        <p className="text-muted-foreground mt-3 text-sm">
          {giveaway.scopeSummaryLabel ?? giveaway.scopeType} ·{" "}
          {giveaway.winnerCount} winner
          {giveaway.winnerCount !== 1 ? "s" : ""} configured
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

          {previewMeta ? (
            <div className="border-border rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
              <h2 className="text-foreground mb-2 text-sm font-semibold">
                Fairness & audit
              </h2>
              <ul className="text-muted-foreground space-y-1 text-sm">
                <li>
                  <span className="text-foreground font-medium">
                    Eligible pool:
                  </span>{" "}
                  {previewMeta.eligiblePoolSize?.toLocaleString() ?? "—"}{" "}
                  accounts (after filters)
                </li>
                <li>
                  <span className="text-foreground font-medium">
                    Snapshot time:
                  </span>{" "}
                  {previewMeta.computedAt
                    ? new Date(previewMeta.computedAt).toLocaleString()
                    : "—"}
                </li>
                <li>
                  <span className="text-foreground font-medium">
                    Selection:
                  </span>{" "}
                  {previewMeta.selectionMode === "WEIGHTED_BY_ENGAGEMENT"
                    ? "Weighted by engagement"
                    : "Unique user (one entry each)"}
                </li>
                <li>
                  <span className="text-foreground font-medium">Rerolls:</span>{" "}
                  {giveaway.rerollCount ?? 0}
                </li>
              </ul>
            </div>
          ) : null}

          {excludedList.length > 0 && giveaway.status === "PREVIEWED" ? (
            <details className="border-border bg-muted/20 rounded-lg border p-4">
              <summary className="text-foreground cursor-pointer text-sm font-medium">
                Manually excluded ({excludedList.length})
              </summary>
              <p className="text-muted-foreground mt-2 text-xs">
                These pubkeys were excluded during preview; the current winner
                set avoids them.
              </p>
              <ul className="mt-2 font-mono text-xs">
                {excludedList.map((pk) => (
                  <li key={pk}>{pk.slice(0, 16)}…</li>
                ))}
              </ul>
            </details>
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
                      max={maxWinnerCount}
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
              <div className="flex flex-wrap gap-2">
                <previewFetcher.Form method="post" className="inline">
                  <input type="hidden" name="intent" value="reroll" />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={previewFetcher.state !== "idle"}
                  >
                    Reroll
                  </Button>
                </previewFetcher.Form>
                <Form method="post" className="inline">
                  <input type="hidden" name="intent" value="resetDraft" />
                  <Button type="submit" variant="secondary">
                    Edit rules
                  </Button>
                </Form>
                <Button
                  type="button"
                  onClick={() => {
                    setShowLockConfirm(true);
                  }}
                >
                  Lock winners
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCancelConfirm(true);
                  }}
                  className="text-destructive border-destructive/40"
                >
                  Cancel giveaway
                </Button>
              </div>
              <AlertDialog
                open={showLockConfirm}
                onOpenChange={setShowLockConfirm}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Lock winners?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Locking finalizes this winner set. You won’t be able to
                      change scope, eligibility, or payout rules afterward —
                      only run payouts and complete the giveaway.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Go back</AlertDialogCancel>
                    <AlertDialogAction asChild>
                      <Button
                        type="button"
                        className="bg-primary text-primary-foreground"
                        disabled={lockFetcher.state !== "idle"}
                        onClick={() => {
                          const fd = new FormData();
                          fd.set("intent", "lock");
                          lockFetcher.submit(fd, { method: "post" });
                        }}
                      >
                        {lockFetcher.state !== "idle"
                          ? "Locking…"
                          : "Lock winners"}
                      </Button>
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
                {giveaway.status === "PREVIEWED"
                  ? "Selected winners"
                  : "Winners"}{" "}
                ({winners.length})
              </h2>
              <ul className="space-y-3">
                {winners.map((w, i) => (
                  <li
                    key={w.pubkey}
                    className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
                      <span className="text-muted-foreground mt-1 text-sm font-medium">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1 space-y-2">
                        <WinnerNpubRow
                          npub={w.npub}
                          displayName={winnerProfiles[w.pubkey]?.displayName}
                          picture={winnerProfiles[w.pubkey]?.picture}
                          profileUrl={nostrUrls.profileUrl(w.npub)}
                        />
                        <div className="flex flex-wrap gap-1">
                          {winnerEngagementBadges(w).map((b) => (
                            <span
                              key={b}
                              className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs"
                            >
                              {b}
                            </span>
                          ))}
                        </div>
                        {w.satsPerWinner != null && w.satsPerWinner > 0 ? (
                          <p className="text-muted-foreground text-xs tabular-nums">
                            {w.satsPerWinner.toLocaleString()} sats
                          </p>
                        ) : null}
                      </div>
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
          payoutProgress={giveaway.payoutProgress}
          payoutState={giveaway.payoutState}
          paidFetcher={paidFetcher}
          getProfileUrl={nostrUrls.profileUrl}
        />
      ) : null}

      {giveaway.status === "PAID_OUT" ? (
        <div className="space-y-4">
          <div className="border-border bg-card rounded-lg border p-5">
            <h2 className="text-foreground text-lg font-semibold">Receipt</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {giveaway.scopeSummaryLabel ?? giveaway.scopeType} ·{" "}
              {winners.length} winner{winners.length !== 1 ? "s" : ""} ·{" "}
              {totalBudgetSats.toLocaleString()} sats (planned) · Completed{" "}
              {giveaway.updatedAt
                ? new Date(giveaway.updatedAt).toLocaleString()
                : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  void copyPublicSummary();
                }}
              >
                Copy public summary
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={exportWinnersCsv}
              >
                Export CSV
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/dashboard/giveaway/proof">Proof cards</Link>
              </Button>
              <Form
                method="post"
                action="/dashboard/giveaway"
                className="inline"
              >
                <input type="hidden" name="intent" value="duplicate" />
                <input type="hidden" name="giveawayId" value={giveaway.id} />
                <Button type="submit" variant="outline">
                  Duplicate giveaway
                </Button>
              </Form>
            </div>
          </div>
          <details className="border-border bg-muted/10 rounded-lg border">
            <summary className="text-foreground cursor-pointer p-4 text-sm font-medium">
              View winners ({winners.length})
            </summary>
            <ul className="border-border space-y-2 border-t p-4">
              {winners.map((w, i) => (
                <li key={w.pubkey} className="flex items-center gap-2 text-sm">
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
          </details>
        </div>
      ) : null}

      {activityEntries.length > 0 ? (
        <div className="border-border bg-muted/10 rounded-lg border">
          <button
            type="button"
            onClick={() => {
              setActivityOpen((o) => !o);
            }}
            className="text-foreground flex w-full items-center justify-between p-4 text-left text-sm font-medium"
          >
            Activity log ({activityEntries.length})
            <span className="text-muted-foreground text-xs">
              {activityOpen ? "Hide" : "Show"}
            </span>
          </button>
          {activityOpen ? (
            <ol className="border-border text-muted-foreground max-h-64 space-y-2 overflow-y-auto border-t p-4 text-xs">
              {[...activityEntries].reverse().map((e) => (
                <li
                  key={`${e.at}-${e.type}-${JSON.stringify(e.payload ?? {})}`}
                >
                  <span className="text-foreground font-medium">
                    {e.type.replace(/_/g, " ")}
                  </span>{" "}
                  · {new Date(e.at).toLocaleString()}
                </li>
              ))}
            </ol>
          ) : null}
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

function PayoutStatusBadge({ status }: { status: string }) {
  const label =
    status === "marked_paid"
      ? "Marked paid"
      : status === "sent"
        ? "Sent"
        : status === "failed"
          ? "Failed"
          : "Pending";
  const cls =
    status === "sent" || status === "marked_paid"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : status === "failed"
        ? "bg-destructive/15 text-destructive"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

function BatchZapFlow({
  giveawayId: _giveawayId,
  winners,
  winnerProfiles,
  lockedAt,
  payoutProgress,
  payoutState = {},
  paidFetcher,
  getProfileUrl,
}: {
  giveawayId: string;
  winners: GiveawayWinnerEntry[];
  winnerProfiles: Record<string, WinnerProfileDisplay>;
  lockedAt: string | null;
  payoutProgress?: GiveawayPayoutProgress | null;
  payoutState?: Record<
    string,
    { status: string; updatedAt?: string; note?: string }
  >;
  paidFetcher: ReturnType<
    typeof useFetcher<{ success?: boolean; error?: string }>
  >;
  getProfileUrl: (npub: string) => string;
}) {
  const payoutFetcher = useFetcher();
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const allSettled =
    winners.length > 0 &&
    winners.every((w) => {
      const s = payoutState[w.pubkey]?.status;
      return s === "sent" || s === "marked_paid";
    });

  const submitPayout = (pubkey: string, status: string) => {
    const fd = new FormData();
    fd.set("intent", "updatePayout");
    fd.set("winnerPubkey", pubkey);
    fd.set("payoutStatus", status);
    payoutFetcher.submit(fd, { method: "post" });
  };

  return (
    <div className="space-y-4">
      <div className="border-border rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <p className="text-foreground font-semibold">
          Locked — payout in progress
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          Winners fixed at{" "}
          {lockedAt ? new Date(lockedAt).toLocaleString() : "—"}. Zap each
          winner, then mark payouts as sent when done.
        </p>
        {payoutProgress ? (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span>
                Progress: {payoutProgress.settledCount}/
                {payoutProgress.totalWinners} marked sent or paid
              </span>
              <span className="text-muted-foreground">
                {payoutProgress.settledSats.toLocaleString()} /{" "}
                {payoutProgress.budgetSats.toLocaleString()} sats (budget)
              </span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full transition-all"
                style={{
                  width: `${payoutProgress.totalWinners > 0 ? (100 * payoutProgress.settledCount) / payoutProgress.totalWinners : 0}%`,
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
      <ul className="border-border divide-border divide-y rounded-lg border">
        {winners.map((w) => {
          const st = payoutState[w.pubkey]?.status ?? "pending";
          return (
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
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <PayoutStatusBadge status={st} />
                  {w.satsPerWinner != null && w.satsPerWinner > 0 ? (
                    <span className="text-muted-foreground text-xs">
                      {w.satsPerWinner.toLocaleString()} sats
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <ZapButton
                  npub={w.npub}
                  amountSats={w.satsPerWinner}
                  size="sm"
                  onZapped={() => {
                    submitPayout(w.pubkey, "sent");
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={payoutFetcher.state !== "idle"}
                  onClick={() => {
                    submitPayout(w.pubkey, "sent");
                  }}
                >
                  Mark as sent
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={payoutFetcher.state !== "idle"}
                  onClick={() => {
                    submitPayout(w.pubkey, "marked_paid");
                  }}
                >
                  Mark paid
                </Button>
                {st === "failed" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={payoutFetcher.state !== "idle"}
                    onClick={() => {
                      submitPayout(w.pubkey, "pending");
                    }}
                  >
                    Retry
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={payoutFetcher.state !== "idle"}
                    onClick={() => {
                      submitPayout(w.pubkey, "failed");
                    }}
                  >
                    Failed
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          disabled={paidFetcher.state !== "idle"}
          onClick={() => {
            if (allSettled) {
              const fd = new FormData();
              fd.set("intent", "markPaidOut");
              paidFetcher.submit(fd, { method: "post" });
            } else {
              setOverrideReason("");
              setShowCompleteDialog(true);
            }
          }}
        >
          Complete giveaway
        </Button>
        {paidFetcher.data &&
        typeof paidFetcher.data === "object" &&
        "error" in paidFetcher.data &&
        paidFetcher.data.error ? (
          <p className="text-destructive text-sm">
            {String(paidFetcher.data.error)}
          </p>
        ) : null}
      </div>
      <AlertDialog
        open={showCompleteDialog}
        onOpenChange={setShowCompleteDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete with pending payouts?</AlertDialogTitle>
            <AlertDialogDescription>
              Not every winner is marked sent or paid. To close this giveaway
              anyway, enter a short reason (at least 10 characters). This is
              recorded for your records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            value={overrideReason}
            onChange={(e) => {
              setOverrideReason(e.target.value);
            }}
            rows={3}
            className="border-border bg-background w-full rounded-md border p-2 text-sm"
            placeholder="Reason for completing before all payouts are marked…"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={
                paidFetcher.state !== "idle" ||
                overrideReason.trim().length < 10
              }
              onClick={() => {
                const fd = new FormData();
                fd.set("intent", "markPaidOut");
                fd.set("completeOverrideReason", overrideReason.trim());
                paidFetcher.submit(fd, { method: "post" });
                setShowCompleteDialog(false);
              }}
            >
              Complete anyway
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
