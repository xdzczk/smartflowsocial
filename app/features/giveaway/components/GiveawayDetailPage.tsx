import { Form, useFetcher, Link, useRouteLoaderData } from "@remix-run/react";
import { Loader2 } from "lucide-react";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  PayoutMethodSelector,
  PayoutProgressCard,
  isPayoutItemSettled,
  mapGiveawayCampaignPhase,
  mapPayoutItemPhase,
  payoutCopy,
} from "~/features/campaign-ui";
import type { BatchPayoutProgressSnapshot } from "~/features/payments/components/BatchPayoutStatusBanner";
import { InvoiceModal } from "~/features/payments/components/InvoiceModal";
import { usePaymentPolling } from "~/features/payments/hooks/usePaymentPolling";
import { getNostrClientUrlsFromUser } from "~/lib/nostr-client-urls";

import { giveawayStatusPillClass } from "../giveaway-status-ui";
import {
  scopeAllowsEngagementEntryTypePick,
  scopeIsFollowGraphAccountPool,
  type GiveawayWinnerEntry,
} from "../types";

interface GiveawayFinalizationQuotePayload {
  plannedPayoutSats: number;
  feeRateBps: number;
  feeSats: number;
  dueNowSats: number;
  waivedByPlan: boolean;
  lockConfigHash: string;
}

const PAID_VIA_WALLET_PHASE = "Paid via wallet";
const PAID_MANUALLY_PHASE = "Paid manually";
const NEEDS_REVIEW_PHASE = "Needs review";

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
  nwc: {
    enabled: boolean;
    maskedString?: string | null;
    lastUsed?: string | null;
  };
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
    plannedPayoutSats?: number | null;
    finalizationFeeSats?: number | null;
    finalizationFeeRateBps?: number | null;
    finalizationFeeStatus?: string | null;
    planAtFinalization?: string | null;
  };
  winnerProfiles?: Record<string, WinnerProfileDisplay>;
  canUsePresets?: boolean;
  maxWinnerCount?: number;
  planType?: string;
  planDisplayName?: string;
  finalizationQuote?: GiveawayFinalizationQuotePayload | null;
  receiptSummaryLine?: string | null;
  publicSummaryText?: string | null;
}

const ENGAGEMENT_OPTIONS = ["REACTION", "REPOST", "COMMENT", "ZAP"] as const;

function formatActivityTypeLabel(type: string): string {
  const map: Record<string, string> = {
    giveaway_created: "Giveaway created",
    configuration_updated: "Giveaway edited",
    preview_generated: "Preview generated",
    rerolled: "Reroll executed",
    winner_excluded: "Winner excluded",
    fee_quoted: "Finalization fee quoted",
    fee_paid: "Finalization fee paid",
    giveaway_locked: "Winners locked",
    locked: "Winners locked",
    csv_exported: "CSV exported",
    proof_summary_copied: "Proof summary copied",
    completed: "Giveaway completed",
    cancelled: "Giveaway cancelled",
    reset_to_draft: "Reset to draft",
  };
  return map[type] ?? type.replace(/_/g, " ");
}

/* eslint-disable sonarjs/cognitive-complexity -- detail page has many fetchers and states */
export function GiveawayDetailPage({
  nwc,
  giveaway,
  winnerProfiles = {},
  canUsePresets = false,
  maxWinnerCount = 50,
  planType = "free",
  planDisplayName = "Free",
  finalizationQuote = null,
  receiptSummaryLine = null,
  publicSummaryText = null,
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
  const invoiceFetcher = useFetcher<{
    success?: boolean;
    error?: string;
    invoice?: string;
    amount?: number;
    paymentId?: string;
    expiresAt?: string;
  }>();
  const activityLogFetcher = useFetcher();
  const [showEdit, setShowEdit] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showFeeInvoiceModal, setShowFeeInvoiceModal] = useState(false);
  const [feeInvoiceData, setFeeInvoiceData] = useState<{
    invoice: string;
    amount: number;
    paymentId: string;
    expiresAt: string;
  } | null>(null);
  const [feeTimeRemaining, setFeeTimeRemaining] = useState(0);
  const [activityOpen, setActivityOpen] = useState(false);

  const handleFeePaymentComplete = useCallback(() => {
    toast.success("Payment received. Click Lock winners to finish.");
    setShowFeeInvoiceModal(false);
    setFeeInvoiceData(null);
  }, []);

  const { isPolling, startPaymentPolling, checkPaymentStatusNow } =
    usePaymentPolling({
      paymentId: feeInvoiceData?.paymentId ?? null,
      onPaymentComplete: handleFeePaymentComplete,
      skipSuccessNavigation: true,
    });

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
      queueMicrotask(() => {
        setShowFinalizeDialog(false);
        setShowFeeInvoiceModal(false);
      });
    }
  }, [lockFetcher.state, lockFetcher.data]);

  useEffect(() => {
    if (invoiceFetcher.state !== "idle" || !invoiceFetcher.data) return;
    const d = invoiceFetcher.data;
    if (d.error) {
      toast.error(d.error);
      return;
    }
    if (
      d.success &&
      d.invoice &&
      d.paymentId &&
      d.expiresAt &&
      d.amount != null
    ) {
      const invoice = d.invoice;
      const amount = d.amount;
      const paymentId = d.paymentId;
      const expiresAt = d.expiresAt;
      queueMicrotask(() => {
        setFeeInvoiceData({
          invoice,
          amount,
          paymentId,
          expiresAt,
        });
        setShowFeeInvoiceModal(true);
        setFeeTimeRemaining(new Date(expiresAt).getTime() - Date.now());
        startPaymentPolling(paymentId);
      });
    }
  }, [invoiceFetcher.state, invoiceFetcher.data, startPaymentPolling]);

  useEffect(() => {
    if (!showFeeInvoiceModal || !feeInvoiceData?.expiresAt) return;
    const tick = () => {
      setFeeTimeRemaining(
        new Date(feeInvoiceData.expiresAt).getTime() - Date.now()
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [showFeeInvoiceModal, feeInvoiceData]);
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
  const unresolvedCount = winners.reduce((acc, w) => {
    const st = giveaway.payoutState?.[w.pubkey]?.status ?? "pending";
    return isPayoutItemSettled(st) ? acc : acc + 1;
  }, 0);
  const phaseLabel = mapGiveawayCampaignPhase(
    giveaway.status,
    giveaway.status === "PAID_OUT" && unresolvedCount > 0
  );

  const copyPublicSummary = async () => {
    const text =
      publicSummaryText ??
      [
        giveaway.name ?? `Giveaway ${giveaway.id.slice(0, 8)}`,
        giveaway.scopeSummaryLabel ?? "",
        `Winners: ${winners.length}`,
        `Sats (planned): ${totalBudgetSats.toLocaleString()}`,
        `Status: ${giveaway.statusLabel ?? giveaway.status}`,
        "Powered by SmartFlow Social",
      ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Summary copied");
      if (giveaway.status === "PAID_OUT") {
        const fd = new FormData();
        fd.set("intent", "logActivity");
        fd.set("activityType", "proof_summary_copied");
        activityLogFetcher.submit(fd, { method: "post" });
      }
    } catch {
      toast.error("Could not copy");
    }
  };

  const copyReceiptSummary = async () => {
    if (!receiptSummaryLine) return;
    try {
      await navigator.clipboard.writeText(receiptSummaryLine);
      toast.success("Receipt copied");
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
    const fd = new FormData();
    fd.set("intent", "logActivity");
    fd.set("activityType", "csv_exported");
    activityLogFetcher.submit(fd, { method: "post" });
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
                ? "This giveaway is ready to finalize. Locking winners applies your plan’s finalization fee (if any) and creates an official record. You can reroll or exclude winners first."
                : giveaway.status === "LOCKED"
                  ? "Winners are fixed. Prize funds remain in your wallet until you choose to pay winners."
                  : giveaway.status === "PAID_OUT"
                    ? "All payouts are resolved. Receipt, proof, and export tools are available below."
                    : "Configure and preview before you lock winners."}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 text-right text-xs">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${giveawayStatusPillClass(giveaway.status)}`}
            >
              {phaseLabel}
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
                {!scopeIsFollowGraphAccountPool(giveaway.scopeType) &&
                Array.isArray(giveaway.engagementTypes) &&
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
                  {scopeIsFollowGraphAccountPool(giveaway.scopeType)
                    ? "uniform random from accounts"
                    : giveaway.selectionMode === "WEIGHTED_BY_ENGAGEMENT"
                      ? "weighted by engagement"
                      : "unique user"}
                </li>
                {giveaway.status === "PREVIEWED" && finalizationQuote ? (
                  <>
                    <li>
                      <span className="text-foreground font-medium">
                        Planned payout:
                      </span>{" "}
                      {finalizationQuote.plannedPayoutSats.toLocaleString()}{" "}
                      sats
                    </li>
                    <li>
                      <span className="text-foreground font-medium">
                        Finalization fee:
                      </span>{" "}
                      {finalizationQuote.plannedPayoutSats <= 0
                        ? "0 sats"
                        : finalizationQuote.waivedByPlan
                          ? `Included (${planDisplayName})`
                          : `${finalizationQuote.feeSats.toLocaleString()} sats on ${planDisplayName}`}
                    </li>
                  </>
                ) : null}
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
                {typeof previewMeta.eligiblePoolSize === "number" &&
                previewMeta.eligiblePoolSize > 0 &&
                previewMeta.eligiblePoolSize < giveaway.winnerCount ? (
                  <li className="text-amber-700 dark:text-amber-400">
                    Only {previewMeta.eligiblePoolSize} eligible account
                    {previewMeta.eligiblePoolSize === 1 ? "" : "s"} found for
                    the current rules, so preview will select{" "}
                    {previewMeta.eligiblePoolSize} winner
                    {previewMeta.eligiblePoolSize === 1 ? "" : "s"}.
                  </li>
                ) : null}
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
                  {scopeIsFollowGraphAccountPool(giveaway.scopeType)
                    ? "Uniform random from accounts"
                    : previewMeta.selectionMode === "WEIGHTED_BY_ENGAGEMENT"
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

          {giveaway.status === "PREVIEWED" && finalizationQuote ? (
            <div className="border-border rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
              <h2 className="text-foreground mb-2 text-sm font-semibold">
                Finalization
              </h2>
              <ul className="text-muted-foreground space-y-1 text-sm">
                <li>
                  <span className="text-foreground font-medium">
                    Planned payout:
                  </span>{" "}
                  {finalizationQuote.plannedPayoutSats.toLocaleString()} sats
                </li>
                <li>
                  <span className="text-foreground font-medium">
                    Your plan:
                  </span>{" "}
                  {planDisplayName}
                </li>
                <li>
                  <span className="text-foreground font-medium">
                    Finalization fee:
                  </span>{" "}
                  {finalizationQuote.plannedPayoutSats <= 0
                    ? "0 sats (selection only)"
                    : finalizationQuote.waivedByPlan
                      ? "Included in your plan"
                      : `${finalizationQuote.feeSats.toLocaleString()} sats (${finalizationQuote.feeRateBps / 100}%)`}
                </li>
                <li>
                  <span className="text-foreground font-medium">
                    Total due at lock:
                  </span>{" "}
                  {finalizationQuote.dueNowSats.toLocaleString()} sats
                </li>
              </ul>
              {finalizationQuote.plannedPayoutSats <= 0 ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  This giveaway selects winners only. No finalization fee will
                  be charged.
                </p>
              ) : null}
              {(planType === "free" || planType === "basic") &&
              finalizationQuote.feeSats > 0 ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  Running giveaways regularly? Upgrade to Premium to reduce or
                  remove finalization fees.
                </p>
              ) : null}
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
                      {scopeIsFollowGraphAccountPool(giveaway.scopeType)
                        ? "How winners are chosen"
                        : "Engagement types"}
                    </span>
                    {scopeAllowsEngagementEntryTypePick(giveaway.scopeType) ? (
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
                    ) : scopeIsFollowGraphAccountPool(giveaway.scopeType) ? (
                      <p className="text-muted-foreground text-sm">
                        Winners are picked at random from eligible accounts in
                        your follower or following list — not from note
                        engagement.
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        For this scope, reactions, reposts, comments, and zaps
                        all count as entries.
                      </p>
                    )}
                  </div>
                  <div>
                    {scopeIsFollowGraphAccountPool(giveaway.scopeType) ? (
                      <>
                        <span className="text-muted-foreground mb-1 block text-sm">
                          Selection mode
                        </span>
                        <p className="text-foreground text-sm">
                          Uniform random from accounts
                        </p>
                        <input
                          type="hidden"
                          name="selectionMode"
                          value="UNIQUE_USER"
                        />
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
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
                    setShowFinalizeDialog(true);
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
              <Dialog
                open={showFinalizeDialog}
                onOpenChange={setShowFinalizeDialog}
              >
                <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Lock winners</DialogTitle>
                  </DialogHeader>
                  <p className="text-muted-foreground text-sm">
                    This action locks the current winner selection and starts
                    payout tracking. The finalization fee covers official
                    locking, audit trail, payout checklist, and receipt tools —
                    not custody of prize funds.
                  </p>
                  {finalizationQuote ? (
                    <div className="bg-muted/40 space-y-1 rounded-md border p-3 text-sm">
                      <p>
                        <span className="text-foreground font-medium">
                          Giveaway:
                        </span>{" "}
                        {(() => {
                          const n = giveaway.name?.trim();
                          return n && n.length > 0
                            ? n
                            : `Giveaway ${giveaway.id.slice(0, 8)}`;
                        })()}
                      </p>
                      <p>
                        <span className="text-foreground font-medium">
                          Scope:
                        </span>{" "}
                        {giveaway.scopeSummaryLabel ?? giveaway.scopeType}
                      </p>
                      <p>
                        <span className="text-foreground font-medium">
                          Winners:
                        </span>{" "}
                        {winners.length}
                      </p>
                      <p>
                        <span className="text-foreground font-medium">
                          Planned payout:
                        </span>{" "}
                        {finalizationQuote.plannedPayoutSats.toLocaleString()}{" "}
                        sats
                      </p>
                      <p>
                        <span className="text-foreground font-medium">
                          Your plan:
                        </span>{" "}
                        {planDisplayName}
                      </p>
                      <p>
                        <span className="text-foreground font-medium">
                          Finalization fee:
                        </span>{" "}
                        {finalizationQuote.plannedPayoutSats <= 0
                          ? "0 sats"
                          : finalizationQuote.waivedByPlan
                            ? "Included in your plan"
                            : `${finalizationQuote.feeSats.toLocaleString()} sats (${finalizationQuote.feeRateBps / 100}%)`}
                      </p>
                      <p>
                        <span className="text-foreground font-medium">
                          Due now:
                        </span>{" "}
                        {finalizationQuote.dueNowSats.toLocaleString()} sats
                      </p>
                    </div>
                  ) : null}
                  <div className="grid gap-2 text-sm">
                    <div className="bg-muted/30 rounded-md border p-3">
                      <p className="text-foreground font-medium">
                        What this includes
                      </p>
                      <ul className="text-muted-foreground mt-1 list-inside list-disc text-xs">
                        <li>Official winner locking</li>
                        <li>Audit trail</li>
                        <li>Payout checklist</li>
                        <li>Receipt and proof tools</li>
                      </ul>
                    </div>
                    <div className="bg-muted/30 rounded-md border p-3">
                      <p className="text-foreground font-medium">
                        What this does not include
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        SmartFlowSocial does not hold prize funds. After lock,
                        you can pay winners manually or with your connected
                        wallet.
                      </p>
                    </div>
                  </div>
                  <p className="text-destructive text-xs font-medium">
                    Locking is irreversible. You cannot reroll after lock.
                  </p>
                  <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowFinalizeDialog(false)}
                    >
                      Cancel
                    </Button>
                    {finalizationQuote && finalizationQuote.feeSats > 0 ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={invoiceFetcher.state !== "idle"}
                        onClick={() => {
                          const fd = new FormData();
                          fd.set("intent", "createFinalizationInvoice");
                          fd.set(
                            "lockConfigHash",
                            finalizationQuote.lockConfigHash
                          );
                          invoiceFetcher.submit(fd, { method: "post" });
                        }}
                      >
                        {invoiceFetcher.state !== "idle"
                          ? "Creating invoice…"
                          : "Pay finalization fee"}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      className="bg-primary text-primary-foreground"
                      disabled={lockFetcher.state !== "idle"}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("intent", "lock");
                        if (finalizationQuote) {
                          fd.set(
                            "lockConfigHash",
                            finalizationQuote.lockConfigHash
                          );
                        }
                        lockFetcher.submit(fd, { method: "post" });
                      }}
                    >
                      {lockFetcher.state !== "idle"
                        ? "Locking…"
                        : finalizationQuote && finalizationQuote.feeSats > 0
                          ? "Lock winners (after paying fee)"
                          : "Lock winners"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
        <div className="space-y-4">
          <div className="border-border rounded-lg border border-amber-500/25 bg-amber-500/10 p-4 text-sm">
            <p className="text-foreground font-semibold">Finalization</p>
            {giveaway.finalizationFeeStatus === "PAID" &&
            giveaway.finalizationFeeSats != null ? (
              <p className="text-muted-foreground mt-1">
                Finalization fee paid:{" "}
                {giveaway.finalizationFeeSats.toLocaleString()} sats
              </p>
            ) : giveaway.finalizationFeeStatus === "WAIVED" ? (
              <p className="text-muted-foreground mt-1">
                Finalization included in your plan
                {giveaway.planAtFinalization
                  ? ` (${giveaway.planAtFinalization})`
                  : ""}
              </p>
            ) : (
              <p className="text-muted-foreground mt-1">
                No finalization fee (selection only or n/a).
              </p>
            )}
            <div className="text-muted-foreground mt-2 space-y-0.5">
              <p>
                Planned payout:{" "}
                {(
                  giveaway.plannedPayoutSats ?? totalBudgetSats
                ).toLocaleString()}{" "}
                sats
              </p>
              <p>
                Finalization fee:{" "}
                {(giveaway.finalizationFeeSats ?? 0).toLocaleString()} sats
              </p>
              {giveaway.planAtFinalization ? (
                <p>Plan: {giveaway.planAtFinalization}</p>
              ) : null}
            </div>
          </div>
          <form
            method="post"
            className="border-border bg-card space-y-3 rounded-lg border p-4"
          >
            <input type="hidden" name="intent" value="updatePayoutSettings" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Payout settings</p>
                <p className="text-muted-foreground text-xs">
                  {payoutCopy.lockTrustNote} Manual payout remains available as
                  fallback.
                </p>
              </div>
              <button
                type="submit"
                className="border-border bg-background hover:bg-muted rounded-md border px-3 py-1.5 text-sm"
              >
                Save
              </button>
            </div>

            <PayoutMethodSelector
              walletMode={
                ((giveaway as { payoutWalletMode?: string }).payoutWalletMode ??
                  "manual") as "manual" | "nwc_creator"
              }
              autoPayEnabled={Boolean(
                (giveaway as { payoutAutoRunEnabled?: unknown })
                  .payoutAutoRunEnabled
              )}
              autoPayCapSats={
                (giveaway as { payoutAutoRunSpendCapSats?: number | null })
                  .payoutAutoRunSpendCapSats ?? null
              }
              nwcEnabled={nwc.enabled}
              autoPayLabel={payoutCopy.autoPayAfterLock}
            />
          </form>
          <BatchZapFlow
            giveawayId={giveaway.id}
            winners={winners}
            winnerProfiles={winnerProfiles}
            lockedAt={giveaway.lockedAt}
            payoutProgress={giveaway.payoutProgress}
            payoutState={giveaway.payoutState}
            paidFetcher={paidFetcher}
            getProfileUrl={nostrUrls.profileUrl}
            nwcEnabled={nwc.enabled}
          />
        </div>
      ) : null}

      {giveaway.status === "PAID_OUT" ? (
        <div className="space-y-4">
          <div className="border-border bg-card rounded-lg border p-5">
            <h2 className="text-foreground text-lg font-semibold">Receipt</h2>
            {unresolvedCount > 0 ? (
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                Completed with issues: {unresolvedCount} payout item
                {unresolvedCount === 1 ? "" : "s"} still need review.
              </p>
            ) : null}
            <p className="text-muted-foreground mt-1 text-sm">
              {giveaway.scopeSummaryLabel ?? giveaway.scopeType} ·{" "}
              {winners.length} winner{winners.length !== 1 ? "s" : ""} ·{" "}
              {(giveaway.plannedPayoutSats ?? totalBudgetSats).toLocaleString()}{" "}
              sats planned ·{" "}
              {(giveaway.finalizationFeeSats ?? 0).toLocaleString()} sats
              finalization fee
              {giveaway.planAtFinalization
                ? ` · Plan: ${giveaway.planAtFinalization}`
                : ""}{" "}
              · Completed{" "}
              {giveaway.updatedAt
                ? new Date(giveaway.updatedAt).toLocaleString()
                : ""}
            </p>
            <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Total recipients</dt>
                <dd>{winners.length}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Paid manually</dt>
                <dd>
                  {
                    winners.filter(
                      (w) =>
                        giveaway.payoutState?.[w.pubkey]?.status ===
                        "marked_paid"
                    ).length
                  }
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Paid via wallet</dt>
                <dd>
                  {
                    winners.filter(
                      (w) => giveaway.payoutState?.[w.pubkey]?.status === "sent"
                    ).length
                  }
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Unresolved</dt>
                <dd>{unresolvedCount}</dd>
              </div>
            </dl>
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
              {receiptSummaryLine ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void copyReceiptSummary();
                  }}
                >
                  Copy receipt summary
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={exportWinnersCsv}
              >
                Export CSV
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/dashboard/giveaway/proof">Proof Studio</Link>
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

      {showFeeInvoiceModal && feeInvoiceData ? (
        <InvoiceModal
          isOpen={showFeeInvoiceModal}
          modalTitle="Pay finalization fee"
          invoiceData={{
            invoice: feeInvoiceData.invoice,
            amount: feeInvoiceData.amount,
            amountUsd: null,
            expiresAt: feeInvoiceData.expiresAt,
            paymentId: feeInvoiceData.paymentId,
            contextLabel:
              "Giveaway finalization fee (locks winners after payment)",
          }}
          timeRemaining={feeTimeRemaining}
          isPolling={isPolling}
          onCopy={(text) => {
            void navigator.clipboard.writeText(text);
            toast.success("Copied");
          }}
          onCheckPayment={(id) => {
            void checkPaymentStatusNow(id);
          }}
          onClose={() => setShowFeeInvoiceModal(false)}
        />
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
            <ol className="border-border text-muted-foreground max-h-64 space-y-3 overflow-y-auto border-t p-4 text-xs">
              {[...activityEntries].reverse().map((e) => (
                <li
                  key={`${e.at}-${e.type}-${JSON.stringify(e.payload ?? {})}`}
                >
                  <div>
                    <span className="text-foreground font-medium">
                      {formatActivityTypeLabel(e.type)}
                    </span>{" "}
                    · {new Date(e.at).toLocaleString()}
                  </div>
                  {e.payload && Object.keys(e.payload).length > 0 ? (
                    <pre className="bg-muted/50 mt-1 max-w-full overflow-x-auto rounded p-2 font-mono text-[10px] leading-snug whitespace-pre-wrap">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  ) : null}
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
  const phase = mapPayoutItemPhase(status);
  const label = phase;
  const cls =
    phase === PAID_VIA_WALLET_PHASE || phase === PAID_MANUALLY_PHASE
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : phase === "Failed"
        ? "bg-destructive/15 text-destructive"
        : phase === NEEDS_REVIEW_PHASE
          ? "bg-amber-500/15 text-amber-900 dark:text-amber-200"
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
  nwcEnabled,
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
  nwcEnabled: boolean;
}) {
  const payoutFetcher = useFetcher();
  const batchPayoutFetcher = useFetcher<{
    success?: boolean;
    error?: string;
    done?: boolean;
    nextStep?: number | null;
    stepIndex?: number;
    totalSteps?: number;
    totals?: {
      items: number;
      paid: number;
      failed: number;
      claimNeeded: number;
      skipped: number;
    };
  }>();
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const isBatchPayoutPending = batchPayoutFetcher.state !== "idle";
  const payoutControlsBusy =
    payoutFetcher.state !== "idle" || batchPayoutFetcher.state !== "idle";

  const batchProgressSnapshot: BatchPayoutProgressSnapshot | null =
    batchPayoutFetcher.data &&
    batchPayoutFetcher.data.success === true &&
    batchPayoutFetcher.data.totals &&
    typeof batchPayoutFetcher.data.stepIndex === "number" &&
    typeof batchPayoutFetcher.data.totalSteps === "number"
      ? {
          stepIndex: batchPayoutFetcher.data.stepIndex,
          totalSteps: batchPayoutFetcher.data.totalSteps,
          totals: {
            paid: batchPayoutFetcher.data.totals.paid,
            failed: batchPayoutFetcher.data.totals.failed,
            claimNeeded: batchPayoutFetcher.data.totals.claimNeeded,
            skipped: batchPayoutFetcher.data.totals.skipped,
          },
        }
      : null;

  useEffect(() => {
    if (batchPayoutFetcher.state !== "idle") return;
    const d = batchPayoutFetcher.data;
    if (!d || d.success !== true) return;
    if (d.done !== false || typeof d.nextStep !== "number") return;
    const fd = new FormData();
    fd.set("intent", "runBatchPayout");
    fd.set("stepIndex", String(d.nextStep));
    batchPayoutFetcher.submit(fd, { method: "post" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chained batch steps; deps are state/data only
  }, [batchPayoutFetcher.state, batchPayoutFetcher.data]);

  const allSettled =
    winners.length > 0 &&
    winners.every((w) => {
      const s = payoutState[w.pubkey]?.status;
      return s === "sent" || s === "marked_paid";
    });
  const payoutTally = winners.reduce(
    (acc, w) => {
      const phase = mapPayoutItemPhase(
        payoutState[w.pubkey]?.status ?? "pending"
      );
      if (phase === "Paid via wallet" || phase === "Paid manually")
        acc.paid += 1;
      else if (phase === "Failed") acc.failed += 1;
      else if (phase === NEEDS_REVIEW_PHASE) acc.needsReview += 1;
      else if (phase === "Skipped") acc.skipped += 1;
      else acc.pending += 1;
      return acc;
    },
    { paid: 0, failed: 0, needsReview: 0, skipped: 0, pending: 0 }
  );

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
        <p className="text-foreground font-semibold">Winners locked</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Winners fixed at{" "}
          {lockedAt ? new Date(lockedAt).toLocaleString() : "—"}.{" "}
          {payoutCopy.lockTrustNote}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!nwcEnabled || payoutControlsBusy}
            onClick={() => {
              const fd = new FormData();
              fd.set("intent", "runBatchPayout");
              fd.set("stepIndex", "0");
              batchPayoutFetcher.submit(fd, { method: "post" });
            }}
            className="bg-primary text-primary-foreground disabled:bg-muted disabled:text-muted-foreground inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium"
            title={
              nwcEnabled
                ? "Pay all winners using your connected wallet"
                : "Connect NWC in Settings to enable auto payouts"
            }
          >
            {isBatchPayoutPending ? (
              <>
                <Loader2
                  className="h-4 w-4 shrink-0 animate-spin"
                  aria-hidden
                />
                Paying winners…
              </>
            ) : (
              payoutCopy.payWinnersNow
            )}
          </button>
          {!nwcEnabled ? (
            <span className="text-muted-foreground text-xs">
              Auto payout requires NWC. Manual zaps still work.
            </span>
          ) : null}
        </div>
        <PayoutProgressCard
          active={isBatchPayoutPending}
          progress={batchProgressSnapshot}
        />
        {batchPayoutFetcher.data &&
        batchPayoutFetcher.data.success === false &&
        batchPayoutFetcher.data.error ? (
          <p className="text-destructive mt-2 text-xs">
            {batchPayoutFetcher.data.error}
          </p>
        ) : null}
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
      <div className="border-border bg-card space-y-2 rounded-lg border p-3 text-sm">
        <p className="font-medium">
          {payoutTally.paid} paid · {payoutTally.failed} failed ·{" "}
          {payoutTally.needsReview} needs review · {payoutTally.skipped} skipped
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={payoutControlsBusy}
            onClick={() => {
              winners.forEach((w) => {
                const phase = mapPayoutItemPhase(
                  payoutState[w.pubkey]?.status ?? "pending"
                );
                if (phase === "Failed" || phase === NEEDS_REVIEW_PHASE) {
                  submitPayout(w.pubkey, "pending");
                }
              });
            }}
          >
            Retry failed
          </Button>
        </div>
      </div>
      <ul className="border-border divide-border divide-y rounded-lg border">
        {winners.map((w) => {
          const st = payoutState[w.pubkey]?.status ?? "pending";
          const phase = mapPayoutItemPhase(st);
          const canRetry = phase === "Failed" || phase === NEEDS_REVIEW_PHASE;
          const canMarkFailed =
            phase === "Pending" || phase === PAID_MANUALLY_PHASE;
          const canMarkManual = phase === "Pending" || phase === "Failed";
          const canUseWallet =
            phase === "Pending" || phase === NEEDS_REVIEW_PHASE;
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
                {canUseWallet ? (
                  <ZapButton
                    npub={w.npub}
                    amountSats={w.satsPerWinner}
                    size="sm"
                    onZapped={() => {
                      submitPayout(w.pubkey, "sent");
                    }}
                  />
                ) : null}
                {canMarkManual ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={payoutControlsBusy}
                    onClick={() => {
                      submitPayout(w.pubkey, "marked_paid");
                    }}
                  >
                    {payoutCopy.markPaidManually}
                  </Button>
                ) : null}
                {canRetry ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={payoutControlsBusy}
                    onClick={() => {
                      submitPayout(w.pubkey, "pending");
                    }}
                  >
                    {payoutCopy.retry}
                  </Button>
                ) : null}
                {canMarkFailed ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={payoutControlsBusy}
                    onClick={() => {
                      submitPayout(w.pubkey, "failed");
                    }}
                  >
                    {payoutCopy.markFailed}
                  </Button>
                ) : null}
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
          Finish campaign
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
              Not all winners are marked paid or sent. SmartFlowSocial does not
              custody prizes — you are responsible for actual payouts. Complete
              anyway only if you accept leaving some payouts untracked here.
              Enter a short reason (at least 10 characters); it is stored in
              your audit log.
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
