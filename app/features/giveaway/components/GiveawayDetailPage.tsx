import { useFetcher, Link } from "@remix-run/react";
import { useState, useEffect } from "react";
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

import type { GiveawayWinnerEntry } from "../types";

function WinnerNpubRow({
  npub,
  onCopy,
}: {
  npub: string;
  onCopy?: () => void;
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
  const profileUrl = `https://nostr.com/p/${npub}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-foreground font-mono text-sm" title={npub}>
        {npub.length > 24 ? `${npub.slice(0, 20)}…${npub.slice(-8)}` : npub}
      </span>
      <button
        type="button"
        onClick={() => {
          void handleCopy();
        }}
        className="text-muted-foreground hover:text-foreground text-xs"
        aria-label="Copy npub"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <a
        href={profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary text-xs"
      >
        Profile
      </a>
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
  canUsePresets?: boolean;
}

const ENGAGEMENT_OPTIONS = ["REACTION", "REPOST", "COMMENT", "ZAP"] as const;

/* eslint-disable sonarjs/cognitive-complexity -- detail page has many fetchers and states */
export function GiveawayDetailPage({
  giveaway,
  canUsePresets = false,
}: GiveawayDetailPageProps) {
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
                  giveaway.filters["excludeBlocked"]) ? (
                  <li>
                    <span className="text-foreground font-medium">
                      Filters:
                    </span>{" "}
                    Exclude muted/blocked
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
                      <WinnerNpubRow npub={w.npub} />
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
          lockedAt={giveaway.lockedAt}
          paidFetcher={paidFetcher}
        />
      ) : null}

      {giveaway.status === "PAID_OUT" ? (
        <div className="border-border rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">Giveaway completed.</p>
          <ul className="text-foreground mt-2 space-y-1 text-sm">
            {winners.map((w, i) => (
              <li key={w.pubkey} className="flex items-center gap-2">
                <span className="text-muted-foreground">{i + 1}.</span>
                <WinnerNpubRow npub={w.npub} />
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
  lockedAt,
  paidFetcher,
}: {
  giveawayId: string;
  winners: GiveawayWinnerEntry[];
  lockedAt: string | null;
  paidFetcher: ReturnType<typeof useFetcher>;
}) {
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState(0);

  useEffect(() => {
    setMarked(getMarkedZapped(giveawayId));
  }, [giveawayId]);

  const currentWinner = winners[step];
  const markedCount = Object.values(marked).filter(Boolean).length;
  const allDone = winners.length === 0 || step >= winners.length;

  const handleMarkZapped = () => {
    if (!currentWinner) return;
    setMarkedZapped(giveawayId, currentWinner.npub, true);
    setMarked((prev) => ({ ...prev, [currentWinner.npub]: true }));
    setStep((s) => Math.min(s + 1, winners.length));
  };

  const handleSkip = () => {
    setStep((s) => Math.min(s + 1, winners.length));
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Locked at {lockedAt ? new Date(lockedAt).toLocaleString() : ""}. Zap
        each winner (or skip), then mark as paid out.
      </p>
      <p className="text-muted-foreground text-xs">
        Winner {step + 1} of {winners.length}
        {winners.length > 0
          ? ` · ${markedCount}/${winners.length} marked zapped`
          : null}
      </p>
      {!allDone && currentWinner ? (
        <div className="border-border bg-muted/30 rounded-lg border p-4">
          <p className="text-muted-foreground mb-2 text-xs">
            Zap in your wallet, then click Mark as zapped to move to the next
            winner.
          </p>
          <div className="mb-3">
            <WinnerNpubRow npub={currentWinner.npub} />
          </div>
          <ZapButton npub={currentWinner.npub} />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleMarkZapped}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm"
            >
              Mark as zapped
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="border-border rounded-md border px-4 py-2 text-sm"
            >
              Skip
            </button>
          </div>
        </div>
      ) : null}
      {allDone ? (
        <paidFetcher.Form method="post">
          <input type="hidden" name="intent" value="markPaidOut" />
          <button
            type="submit"
            className="bg-primary text-primary-foreground rounded-md px-4 py-2"
            disabled={paidFetcher.state !== "idle"}
          >
            Mark as paid out
          </button>
        </paidFetcher.Form>
      ) : null}
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
