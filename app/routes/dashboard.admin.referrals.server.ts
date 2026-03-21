/**
 * Referrals tab: loader (tables + audit) and payout actions (NWC / ws polyfill server-only).
 */

import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";

import { getAdminOverviewStats } from "~/features/admin/repositories/admin-overview-stats-data.server";
import { requireUser } from "~/features/auth";
import {
  earningsToCsv,
  getEarningsAdmin,
  getReferralsAdmin,
  isReferralAdmin,
  referralsToCsv,
  retryFailedPayout,
} from "~/features/referral/referral-admin.server";
import { listReferralPayoutAuditLogs } from "~/features/referral/referral-payout-audit.server";
import {
  getReferralBatchPreview,
  payReferrerWithInvoice,
  runReferralPayoutBatch,
} from "~/features/referral/referral-payout.server";
import { withCSRFProtection } from "~/lib/csrf";
import { env } from "~/lib/env.server";

if (
  env.NODE_ENV !== "development" &&
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Node may lack WebSocket until polyfilled
  globalThis.WebSocket === undefined
) {
  const { WebSocket } = require("ws") as {
    WebSocket: typeof globalThis.WebSocket;
  };
  globalThis.WebSocket = WebSocket;
}

export type ReferralPayoutBatchResult = Awaited<
  ReturnType<typeof runReferralPayoutBatch>
>;

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (!isReferralAdmin(user.npub)) {
    return json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const exportCsv = url.searchParams.get("export") === "csv";
  const exportEarnings = url.searchParams.get("export_earnings") === "csv";
  const section = url.searchParams.get("section") ?? "referrals";
  const referrerNpub = url.searchParams.get("referrer_npub") ?? undefined;
  const referredNpub = url.searchParams.get("referred_npub") ?? undefined;
  const dateFrom = url.searchParams.get("date_from") ?? undefined;
  const dateTo = url.searchParams.get("date_to") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const page = url.searchParams.get("page");
  const pageNum = page ? Math.max(1, parseInt(page, 10)) : 1;

  const referralsResult = await getReferralsAdmin({
    referrerNpub,
    referredNpub,
    dateFrom,
    dateTo,
    page: pageNum,
  });

  if (exportCsv) {
    const csv = referralsToCsv(referralsResult.referrals);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="referrals.csv"',
      },
    });
  }

  const earningsResult = await getEarningsAdmin({
    referrerNpub,
    status,
    dateFrom,
    dateTo,
    page: pageNum,
  });

  if (exportEarnings) {
    const csv = earningsToCsv(earningsResult.earnings);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="referral_earnings.csv"',
      },
    });
  }

  const [stats, auditLogs, batchPreview] = await Promise.all([
    getAdminOverviewStats(),
    listReferralPayoutAuditLogs(100),
    getReferralBatchPreview(),
  ]);

  return json({
    section,
    payoutAvailable: Boolean(env.OWNER_NWC?.trim()),
    stats,
    batchPreview,
    referrals: {
      rows: referralsResult.referrals.map((r) => ({
        referrerNpub: r.referrerNpub,
        referredNpub: r.referredNpub,
        createdAt: r.createdAt.toISOString(),
      })),
      total: referralsResult.total,
      page: referralsResult.page,
      pageSize: referralsResult.pageSize,
    },
    earnings: {
      rows: earningsResult.earnings.map((e) => ({
        id: e.id,
        referrerNpub: e.referrerNpub,
        referredNpub: e.referredNpub,
        paymentId: e.paymentId,
        commissionSats: e.commissionSats,
        status: e.status,
        payoutFailureReason: e.payoutFailureReason,
        createdAt: e.createdAt.toISOString(),
        paidAt: e.paidAt?.toISOString() ?? null,
      })),
      total: earningsResult.total,
      page: earningsResult.page,
      pageSize: earningsResult.pageSize,
    },
    auditLogs: auditLogs.map((a) => ({
      id: a.id,
      channel: a.channel,
      referrerNpub: a.referrerNpub,
      amountSats: a.amountSats,
      status: a.status,
      batchSummary: a.batchSummary,
      errorMessage: a.errorMessage,
      operatorNpub: a.operatorNpub,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    const user = await requireUser(request);
    if (!isReferralAdmin(user.npub)) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const _action = formData.get("_action");

    if (_action === "retry_payout") {
      const earningId = formData.get("earning_id");
      if (typeof earningId !== "string") {
        return json({ error: "Missing earning_id" }, { status: 400 });
      }
      const result = await retryFailedPayout(earningId);
      if (!result.success) {
        return json({ error: result.error }, { status: 400 });
      }
      return json({ success: true });
    }

    if (!env.OWNER_NWC?.trim()) {
      return json(
        { error: "OWNER_NWC is not configured; payouts are disabled." },
        { status: 400 }
      );
    }

    if (_action === "run_batch_payout") {
      if (formData.get("confirm_batch") !== "on") {
        return json(
          { error: "Check the confirmation box to run the batch payout." },
          { status: 400 }
        );
      }
      const phrase = String(formData.get("confirm_phrase") ?? "").trim();
      if (phrase !== "PAY") {
        return json(
          {
            error:
              "Type PAY in the confirmation field to authorize this batch.",
          },
          { status: 400 }
        );
      }
      const result = await runReferralPayoutBatch({
        operatorNpub: user.npub,
      });
      return json({ ok: true as const, batch: result });
    }

    if (_action === "manual_payout") {
      const referrerNpub = String(formData.get("referrer_npub") ?? "").trim();
      const bolt11 = String(formData.get("bolt11") ?? "").trim();
      const amountRaw = formData.get("amount_sats");
      const amountSats =
        typeof amountRaw === "string" ? parseInt(amountRaw, 10) : NaN;

      if (
        !referrerNpub ||
        !bolt11 ||
        !Number.isFinite(amountSats) ||
        amountSats < 1
      ) {
        return json(
          {
            error:
              "Invalid form: referrer npub, BOLT11 invoice, and a positive amount (sats) are required.",
          },
          { status: 400 }
        );
      }

      const result = await payReferrerWithInvoice(
        referrerNpub,
        bolt11,
        amountSats,
        { channel: "manual", operatorNpub: user.npub }
      );

      if (!result.success) {
        return json(
          { error: result.error ?? "Payment failed" },
          { status: 422 }
        );
      }

      return json({
        ok: true as const,
        manual: { paidSats: amountSats, referrerNpub },
      });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  }
);
