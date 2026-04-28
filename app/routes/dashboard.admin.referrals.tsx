import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import { useState } from "react";

import { ADMIN_PAGE_BODY_CLASS } from "~/components/layout/page-layout-constants";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  AdminAccessDenied,
  AdminCard,
  AdminPageHeader,
  MetricCard,
  useAdminCurrency,
} from "~/features/admin";
import type { AdminOverviewStats } from "~/features/admin/repositories/admin-overview-stats-data.server";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";

import { action, loader } from "./dashboard.admin.referrals.server";
import type { ReferralPayoutBatchResult } from "./dashboard.admin.referrals.server";

export { action, loader };

// Remix json() return typing is loose; narrow at runtime.
function isLoaderOk(d: unknown): d is {
  section: string;
  rangePreset: string;
  payoutAvailable: boolean;
  stats: AdminOverviewStats;
  monetization: {
    referredRevenueSatsInRange: number;
    totalPaymentSatsInRange: number;
  };
  referredPaidConversionsInRange: number;
  referrals: {
    rows: Array<{
      referrerNpub: string;
      referredNpub: string;
      createdAt: string;
    }>;
    total: number;
    page: number;
    pageSize: number;
  };
  earnings: {
    rows: Array<{
      id: string;
      referrerNpub: string;
      referredNpub: string;
      paymentId: string;
      commissionSats: number;
      status: string;
      payoutFailureReason: string | null;
      createdAt: string;
      paidAt: string | null;
    }>;
    total: number;
    page: number;
    pageSize: number;
  };
  auditLogs: Array<{
    id: string;
    channel: string;
    referrerNpub: string | null;
    amountSats: number | null;
    status: string;
    batchSummary: unknown;
    errorMessage: string | null;
    operatorNpub: string | null;
    createdAt: string;
  }>;
  batchPreview: {
    rows: Array<{
      referrerNpub: string;
      pendingSats: number;
      ready: boolean;
      skipReason: string | null;
    }>;
    totalSatsReady: number;
    readyCount: number;
    skippedCount: number;
  };
} {
  return typeof d === "object" && d !== null && "batchPreview" in d;
}

type ActionData =
  | { error: string }
  | { ok: true; batch: ReferralPayoutBatchResult }
  | { ok: true; manual: { paidSats: number; referrerNpub: string } }
  | { success: true };

function isActionError(d: ActionData | undefined): d is { error: string } {
  return d !== undefined && "error" in d;
}

function isBatchActionOk(
  d: ActionData | undefined
): d is { ok: true; batch: ReferralPayoutBatchResult } {
  return d !== undefined && "batch" in d;
}

function isManualActionOk(
  d: ActionData | undefined
): d is { ok: true; manual: { paidSats: number; referrerNpub: string } } {
  return d !== undefined && "manual" in d;
}

export default function AdminReferralsPage() {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Remix loader JSON
  const raw = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const [searchParams] = useSearchParams();
  const [batchOpen, setBatchOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const { formatDate, dateLocale } = useFormattedDate();

  const formatDateTime = (iso: string) =>
    formatDate(iso, {
      dateFormatOptions: {
        dateStyle: "medium",
        timeStyle: "short",
      },
    });

  const { unit, formatSats, moneyColumnLabel } = useAdminCurrency();

  if (!isLoaderOk(raw)) {
    return <AdminAccessDenied />;
  }

  const data = raw;
  const {
    stats,
    referrals,
    earnings,
    auditLogs,
    payoutAvailable,
    batchPreview,
  } = data;
  const totalRefPages = Math.ceil(referrals.total / referrals.pageSize);
  const totalEarnPages = Math.ceil(earnings.total / earnings.pageSize);

  return (
    <div>
      <AdminPageHeader
        title="Referrals & payouts"
        subtitle="Finance-ops surface: performance, ledger, CSV exports, and Lightning payouts. Confirm every batch in the dialog."
      />

      <div className={`${ADMIN_PAGE_BODY_CLASS} space-y-10`}>
        {isActionError(actionData) ? (
          <div
            className="border-danger/50 bg-danger/10 text-danger rounded-md border px-3 py-2 text-sm"
            role="alert"
          >
            {actionData.error}
          </div>
        ) : null}

        {isBatchActionOk(actionData) ? (
          <div
            className="border-border bg-surface-hover/40 rounded-md border px-3 py-2 text-sm"
            role="status"
          >
            <p className="font-medium">Batch finished</p>
            <ul className="mt-1 list-inside list-disc text-xs">
              <li>Processed: {actionData.batch.processed}</li>
              <li>Paid: {actionData.batch.paid}</li>
              <li>Failed: {actionData.batch.failed}</li>
              <li>Skipped: {actionData.batch.skipped}</li>
            </ul>
          </div>
        ) : null}

        {isManualActionOk(actionData) ? (
          <div
            className="border-border bg-surface-hover/40 rounded-md border px-3 py-2 text-sm"
            role="status"
          >
            Paid {formatSats(actionData.manual.paidSats, dateLocale)} to
            referrer{" "}
            <span className="font-mono text-xs">
              {actionData.manual.referrerNpub}
            </span>
            .
          </div>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-text-secondary text-sm font-semibold tracking-wide uppercase">
            Business value (selected range)
          </h2>
          <p className="text-text-secondary text-xs">
            Range: {data.rangePreset}. Adjust via admin tab range control.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Referral commission (range)"
              value={formatSats(
                data.monetization.referredRevenueSatsInRange,
                dateLocale
              )}
              definition="ReferralEarning rows created in the window (commission sats)."
            />
            <MetricCard
              title="Referred paid conversions (range)"
              value={data.referredPaidConversionsInRange}
              definition="Earning rows marked PAID with paidAt in the window."
            />
            <MetricCard
              title={
                unit === "SATS"
                  ? "All payments (sats, range)"
                  : `All payments (${unit}, range)`
              }
              value={formatSats(
                data.monetization.totalPaymentSatsInRange,
                dateLocale
              )}
              definition="Completed subscription-related payments in range (platform-wide context)."
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-text-secondary text-sm font-semibold tracking-wide uppercase">
            Referral performance
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Referral links"
              value={stats.referralLinkCount}
            />
            <MetricCard
              title="Pending payout entries"
              value={stats.referralEarningsByStatus.pending}
            />
            <MetricCard
              title="Paid entries"
              value={stats.referralEarningsByStatus.paid}
            />
            <MetricCard
              title="Failed entries"
              value={stats.referralEarningsByStatus.failed}
            />
            <MetricCard
              title={
                unit === "SATS"
                  ? "Pending commission (sats)"
                  : `Pending commission (${unit})`
              }
              value={formatSats(
                stats.referralPendingCommissionSats,
                dateLocale
              )}
            />
            <MetricCard
              title="Ready for batch payout"
              value={stats.referralPayoutEligibleCount}
            />
          </div>
        </section>

        <AdminCard variant="muted" className="space-y-2">
          <p className="text-text-secondary text-[11px] font-semibold tracking-wide uppercase">
            Payout readiness
          </p>
          <ul className="text-text/90 space-y-1 text-sm">
            <li>
              Owner wallet (NWC):{" "}
              {payoutAvailable ? (
                <Badge variant="secondary" className="ml-1">
                  Configured
                </Badge>
              ) : (
                <Badge variant="outline" className="ml-1">
                  Not set
                </Badge>
              )}
            </li>
            <li>
              Batch preview:{" "}
              <span className="font-medium tabular-nums">
                {batchPreview.readyCount}
              </span>{" "}
              ready ·{" "}
              <span className="font-medium tabular-nums">
                {batchPreview.skippedCount}
              </span>{" "}
              would skip at fetch time ·{" "}
              <span className="font-medium tabular-nums">
                {formatSats(batchPreview.totalSatsReady, dateLocale)}
              </span>{" "}
              in ready rows
            </li>
          </ul>
        </AdminCard>

        <section className="border-border bg-surface/40 shadow-1 space-y-4 rounded-xl border p-5">
          <h2 className="text-lg font-semibold">Payout actions</h2>
          {!payoutAvailable ? (
            <p className="text-text-secondary text-sm">
              Set <code className="text-xs">OWNER_NWC</code> to enable payouts.
            </p>
          ) : null}

          <div className="space-y-3">
            <h3 className="font-medium">Batch payout</h3>
            <p className="text-text-secondary text-xs leading-relaxed">
              Same rules as automation: ≥1000 sats pending per referrer and a
              valid https LNURL/LUD destination. Review the preview, then type{" "}
              <span className="text-text font-mono">PAY</span> to arm the
              confirm button.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={!payoutAvailable || busy}
              onClick={() => setBatchOpen(true)}
            >
              Open batch review…
            </Button>
            <AlertDialog open={batchOpen} onOpenChange={setBatchOpen}>
              <AlertDialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm batch payout</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="text-text-secondary space-y-3 text-sm">
                      <p>
                        Attempts Lightning payouts using{" "}
                        <code className="text-text">OWNER_NWC</code> for each{" "}
                        <strong>ready</strong> row below.
                      </p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="border-border max-h-56 overflow-auto rounded-md border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-hover/50 sticky top-0">
                      <tr>
                        <th className="p-2">Referrer</th>
                        <th className="p-2 text-right">{moneyColumnLabel}</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchPreview.rows.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-text-secondary p-3">
                            No referrers meet the ≥1000 sats threshold.
                          </td>
                        </tr>
                      ) : (
                        batchPreview.rows.map((row) => (
                          <tr key={row.referrerNpub} className="border-t">
                            <td className="max-w-[180px] truncate p-2 font-mono">
                              {row.referrerNpub}
                            </td>
                            <td className="p-2 text-right tabular-nums">
                              {formatSats(row.pendingSats, dateLocale)}
                            </td>
                            <td className="p-2">
                              {row.ready ? (
                                <Badge variant="secondary">Ready</Badge>
                              ) : (
                                <span className="text-text-secondary">
                                  Skipped — {row.skipReason}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <Form
                  method="post"
                  onSubmit={() => setBatchOpen(false)}
                  className="space-y-4"
                >
                  <input
                    type="hidden"
                    name="_action"
                    value="run_batch_payout"
                  />
                  <input type="hidden" name="confirm_batch" value="on" />
                  <div className="space-y-2">
                    <Label htmlFor="confirm_phrase">
                      Type <span className="font-mono">PAY</span> to authorize
                    </Label>
                    <Input
                      id="confirm_phrase"
                      name="confirm_phrase"
                      autoComplete="off"
                      placeholder="PAY"
                      className="font-mono"
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                    <Button type="submit" disabled={!payoutAvailable || busy}>
                      {busy ? "Working…" : "Run batch"}
                    </Button>
                  </AlertDialogFooter>
                </Form>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="border-border space-y-3 border-t pt-4">
            <h3 className="font-medium">Manual Lightning payout</h3>
            <p className="text-text-secondary text-xs">
              Pay a specific BOLT11 against pending balance — opens a second
              confirmation step.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={!payoutAvailable || busy}
              onClick={() => setManualOpen(true)}
            >
              Start manual payment…
            </Button>
            <Dialog open={manualOpen} onOpenChange={setManualOpen}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Manual Lightning payment</DialogTitle>
                  <DialogDescription>
                    Sends sats via NWC to the invoice you paste. Double-check
                    amount and destination.
                  </DialogDescription>
                </DialogHeader>
                <Form
                  method="post"
                  className="grid gap-3"
                  onSubmit={() => setManualOpen(false)}
                >
                  <input type="hidden" name="_action" value="manual_payout" />
                  <div>
                    <Label htmlFor="referrer_npub">Referrer npub</Label>
                    <Input
                      id="referrer_npub"
                      name="referrer_npub"
                      className="mt-1 font-mono text-xs"
                      placeholder="npub1…"
                      disabled={!payoutAvailable || busy}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <Label htmlFor="amount_sats">Amount (sats)</Label>
                    <Input
                      id="amount_sats"
                      name="amount_sats"
                      type="number"
                      min={1}
                      className="mt-1"
                      disabled={!payoutAvailable || busy}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bolt11">BOLT11 invoice</Label>
                    <textarea
                      id="bolt11"
                      name="bolt11"
                      rows={3}
                      className="border-border mt-1 w-full rounded-md border px-2 py-1 font-mono text-xs"
                      disabled={!payoutAvailable || busy}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setManualOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={!payoutAvailable || busy}>
                      {busy ? "Working…" : "Send payment"}
                    </Button>
                  </DialogFooter>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Payout ledger</h2>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-hover/50 border-b">
                  <th className="p-2 text-left">Time</th>
                  <th className="p-2 text-left">Channel</th>
                  <th className="p-2 text-left">Referrer</th>
                  <th className="p-2 text-right">{moneyColumnLabel}</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Detail</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-text-secondary p-4">
                      No payout activity logged yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="p-2 text-xs whitespace-nowrap">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="p-2 font-mono text-xs">{row.channel}</td>
                      <td className="max-w-[140px] truncate p-2 font-mono text-xs">
                        {row.referrerNpub ?? "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {row.amountSats == null
                          ? "—"
                          : formatSats(row.amountSats, dateLocale)}
                      </td>
                      <td className="p-2">
                        <Badge
                          variant={
                            row.status === "success"
                              ? "secondary"
                              : "destructive"
                          }
                          className="font-normal capitalize"
                        >
                          {row.status}
                        </Badge>
                      </td>
                      <td className="text-text-secondary max-w-md p-2 text-xs">
                        {row.errorMessage ? (
                          <span className="text-danger">
                            {row.errorMessage}
                          </span>
                        ) : row.batchSummary ? (
                          <details>
                            <summary className="text-text cursor-pointer text-[11px] font-medium">
                              View batch summary
                            </summary>
                            <pre className="border-border bg-surface-hover/30 mt-1 max-h-36 overflow-auto rounded-xs border p-2 font-mono text-[10px] leading-snug">
                              {JSON.stringify(row.batchSummary, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <h2 className="text-lg font-semibold">Referrals table</h2>
            <a
              href={`?${new URLSearchParams([...searchParams.entries(), ["export", "csv"]]).toString()}`}
              className="text-link hover:text-link-hover text-sm hover:underline"
            >
              Export CSV
            </a>
          </div>
          <p className="text-text-secondary text-sm">
            Page {referrals.page} of {totalRefPages || 1} · {referrals.total}{" "}
            total
          </p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">Referrer</th>
                  <th className="p-2 text-left">Referred</th>
                  <th className="p-2 text-left">Created</th>
                </tr>
              </thead>
              <tbody>
                {referrals.rows.map((r) => (
                  <tr key={r.referredNpub} className="border-b">
                    <td className="p-2 font-mono text-xs">{r.referrerNpub}</td>
                    <td className="p-2 font-mono text-xs">{r.referredNpub}</td>
                    <td className="p-2">{formatDateTime(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <h2 className="text-lg font-semibold">Earnings table</h2>
            <a
              href={`?${new URLSearchParams([...searchParams.entries(), ["export_earnings", "csv"]]).toString()}`}
              className="text-link hover:text-link-hover text-sm hover:underline"
            >
              Export earnings CSV
            </a>
          </div>
          <p className="text-text-secondary text-sm">
            Page {earnings.page} of {totalEarnPages || 1} · {earnings.total}{" "}
            total
          </p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">Referrer</th>
                  <th className="p-2 text-right">Commission</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {earnings.rows.map((e) => (
                  <tr key={e.id} className="border-b">
                    <td className="max-w-[140px] truncate p-2 font-mono text-xs">
                      {e.referrerNpub}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {formatSats(e.commissionSats, dateLocale)}
                    </td>
                    <td className="p-2">
                      {e.status}
                      {e.payoutFailureReason
                        ? ` (${e.payoutFailureReason})`
                        : ""}
                    </td>
                    <td className="p-2">
                      {e.status === "FAILED" ? (
                        <Form method="post">
                          <input
                            type="hidden"
                            name="_action"
                            value="retry_payout"
                          />
                          <input type="hidden" name="earning_id" value={e.id} />
                          <button
                            type="submit"
                            className="text-link hover:text-link-hover text-xs hover:underline"
                          >
                            Retry
                          </button>
                        </Form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Link
          to="/dashboard/admin"
          className="text-link hover:text-link-hover text-sm hover:underline"
        >
          ← Back to overview
        </Link>
      </div>
    </div>
  );
}
