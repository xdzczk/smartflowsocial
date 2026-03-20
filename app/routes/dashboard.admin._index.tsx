/**
 * Operator admin overview: global DB stats + referral payout actions.
 */

import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";

import { getAdminOverviewStats } from "~/features/admin/repositories/admin-overview-stats-data.server";
import { requireUser } from "~/features/auth";
import { isReferralAdmin } from "~/features/referral/referral-admin.server";
import {
  payReferrerWithInvoice,
  runReferralPayoutBatch,
} from "~/features/referral/referral-payout.server";
import { env } from "~/lib/env.server";

// Polyfill WebSocket for @getalby/sdk in Node.js (production only)
if (
  env.NODE_ENV !== "development" &&
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime polyfill check
  globalThis.WebSocket === undefined
) {
  const { WebSocket } = require("ws") as {
    WebSocket: typeof globalThis.WebSocket;
  };
  globalThis.WebSocket = WebSocket;
}

interface AdminOverviewLoaderSuccess {
  stats: Awaited<ReturnType<typeof getAdminOverviewStats>>;
  payoutAvailable: boolean;
}

function isLoaderSuccess(
  d: { error?: string } | AdminOverviewLoaderSuccess
): d is AdminOverviewLoaderSuccess {
  return !("error" in d && d.error !== undefined);
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (!isReferralAdmin(user.npub)) {
    return json({ error: "Forbidden" }, { status: 403 });
  }

  const stats = await getAdminOverviewStats();
  return json({
    stats,
    payoutAvailable: Boolean(env.OWNER_NWC?.trim()),
  } satisfies AdminOverviewLoaderSuccess);
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  if (!isReferralAdmin(user.npub)) {
    return json({ error: "Forbidden" }, { status: 403 });
  }

  if (!env.OWNER_NWC?.trim()) {
    return json(
      { error: "OWNER_NWC is not configured; payouts are disabled." },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const _action = formData.get("_action");

  if (_action === "run_batch_payout") {
    if (formData.get("confirm_batch") !== "on") {
      return json(
        { error: "Check the confirmation box to run the batch payout." },
        { status: 400 }
      );
    }
    const result = await runReferralPayoutBatch();
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
      amountSats
    );

    if (!result.success) {
      return json({ error: result.error ?? "Payment failed" }, { status: 422 });
    }

    return json({
      ok: true as const,
      manual: { paidSats: amountSats, referrerNpub },
    });
  }

  return json({ error: "Invalid action" }, { status: 400 });
}

type LoaderData = { error: string } | AdminOverviewLoaderSuccess;

type ActionData =
  | { error: string }
  | { ok: true; batch: Awaited<ReturnType<typeof runReferralPayoutBatch>> }
  | { ok: true; manual: { paidSats: number; referrerNpub: string } };

function isBatchSuccess(
  d: ActionData | undefined
): d is {
  ok: true;
  batch: Awaited<ReturnType<typeof runReferralPayoutBatch>>;
} {
  return Boolean(d && "batch" in d);
}

function isManualSuccess(d: ActionData | undefined): d is {
  ok: true;
  manual: { paidSats: number; referrerNpub: string };
} {
  return Boolean(d && "manual" in d);
}

export default function AdminOverviewPage() {
  const data = useLoaderData<typeof loader>() as LoaderData;
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  if (!isLoaderSuccess(data)) {
    return <div className="p-4">Access denied.</div>;
  }

  const { stats, payoutAvailable } = data;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4">
      <div>
        <h1 className="text-2xl font-bold">Admin overview</h1>
        <p className="text-muted-foreground text-sm">
          Global database stats and referral payout tools. Same access as
          referral admin (<code className="text-xs">ADMIN_NPUBS</code>).
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            to="/dashboard/admin/referrals"
            className="text-primary text-sm hover:underline"
          >
            Referrals table
          </Link>
          <Link
            to="/dashboard/admin/earnings"
            className="text-primary text-sm hover:underline"
          >
            Earnings table
          </Link>
        </div>
      </div>

      {actionData && "error" in actionData ? (
        <div
          className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
          role="alert"
        >
          {actionData.error}
        </div>
      ) : null}

      {isBatchSuccess(actionData) ? (
        <div
          className="border-border bg-muted/40 rounded-md border px-3 py-2 text-sm"
          role="status"
        >
          <p className="font-medium">Batch payout finished</p>
          <ul className="mt-1 list-inside list-disc text-xs">
            <li>Processed: {actionData.batch.processed}</li>
            <li>Paid: {actionData.batch.paid}</li>
            <li>Failed: {actionData.batch.failed}</li>
            <li>Skipped: {actionData.batch.skipped}</li>
          </ul>
          {actionData.batch.errors.length > 0 ? (
            <pre className="mt-2 max-h-40 overflow-auto text-xs whitespace-pre-wrap">
              {actionData.batch.errors.join("\n")}
            </pre>
          ) : null}
        </div>
      ) : null}

      {isManualSuccess(actionData) ? (
        <div
          className="border-border bg-muted/40 rounded-md border px-3 py-2 text-sm"
          role="status"
        >
          Paid {actionData.manual.paidSats} sats to referrer (invoice matched
          pending balance rules).
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Users and subscriptions</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Total users" value={stats.usersTotal} />
          <StatCard label="Enabled users" value={stats.usersEnabled} />
          <StatCard
            label="Active subscriptions"
            value={stats.subscriptionsActive}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Short posts by state</h2>
        <p className="text-muted-foreground text-xs">
          <code>Post.currentState</code> (state machine). Scheduled-style states
          include SCHEDULED, PUBLISHING, etc.
        </p>
        <StateTable rows={stats.postsByCurrentState} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Long-form by state</h2>
        <p className="text-muted-foreground text-xs">
          <code>LongFormPost.currentState</code>
        </p>
        <StateTable rows={stats.longFormByCurrentState} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Referrals</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Referral links" value={stats.referralLinkCount} />
          <StatCard
            label="Earnings pending (rows)"
            value={stats.referralEarningsByStatus.pending}
          />
          <StatCard
            label="Earnings paid (rows)"
            value={stats.referralEarningsByStatus.paid}
          />
          <StatCard
            label="Earnings failed (rows)"
            value={stats.referralEarningsByStatus.failed}
          />
        </div>
        <p className="text-sm">
          Pending commission (sum):{" "}
          <span className="font-mono font-medium">
            {stats.referralPendingCommissionSats} sats
          </span>
        </p>
        <p className="text-sm">
          Eligible for auto batch (≥1000 sats pending + LNURL):{" "}
          <span className="font-mono font-medium">
            {stats.referralPayoutEligibleCount}
          </span>
        </p>
        {stats.referralPayoutEligiblePreviewNpubs.length > 0 ? (
          <div className="text-muted-foreground text-xs">
            <span className="text-foreground font-medium">
              Preview referrers:
            </span>{" "}
            {stats.referralPayoutEligiblePreviewNpubs.join(", ")}
            {stats.referralPayoutEligibleCount >
            stats.referralPayoutEligiblePreviewNpubs.length
              ? " …"
              : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Payout actions</h2>
        {!payoutAvailable ? (
          <p className="text-muted-foreground text-sm">
            Set <code className="text-xs">OWNER_NWC</code> to enable Lightning
            payouts from this UI (same as cron batch).
          </p>
        ) : null}

        <div className="border-border space-y-3 rounded-lg border p-4">
          <h3 className="font-medium">Run batch payout</h3>
          <p className="text-muted-foreground text-xs">
            Same logic as cron: referrers with ≥1000 sats pending and https
            LNURL payout destination. Skips referrers without a valid URL
            destination.
          </p>
          <Form method="post" className="space-y-3">
            <input type="hidden" name="_action" value="run_batch_payout" />
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="confirm_batch"
                value="on"
                className="mt-1"
                disabled={!payoutAvailable || busy}
              />
              <span>
                I understand this will attempt Lightning payouts using{" "}
                <code className="text-xs">OWNER_NWC</code> for all eligible
                referrers.
              </span>
            </label>
            <button
              type="submit"
              disabled={!payoutAvailable || busy}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy ? "Working…" : "Run batch payout"}
            </button>
          </Form>
        </div>

        <div className="border-border space-y-3 rounded-lg border p-4">
          <h3 className="font-medium">Manual payout (BOLT11)</h3>
          <p className="text-muted-foreground text-xs">
            Pay a specific invoice; amount must not exceed that referrer&apos;s
            pending commission total. Marks oldest pending earnings as paid on
            success.
          </p>
          <Form method="post" className="grid max-w-xl gap-3">
            <input type="hidden" name="_action" value="manual_payout" />
            <div>
              <label className="text-sm font-medium" htmlFor="referrer_npub">
                Referrer npub
              </label>
              <input
                id="referrer_npub"
                name="referrer_npub"
                className="border-input mt-1 w-full rounded-md border px-2 py-1 font-mono text-xs"
                placeholder="npub1…"
                disabled={!payoutAvailable || busy}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="amount_sats">
                Amount (sats)
              </label>
              <input
                id="amount_sats"
                name="amount_sats"
                type="number"
                min={1}
                className="border-input mt-1 w-full rounded-md border px-2 py-1 text-sm"
                disabled={!payoutAvailable || busy}
              />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="bolt11">
                BOLT11 invoice
              </label>
              <textarea
                id="bolt11"
                name="bolt11"
                rows={3}
                className="border-input mt-1 w-full rounded-md border px-2 py-1 font-mono text-xs"
                disabled={!payoutAvailable || busy}
              />
            </div>
            <button
              type="submit"
              disabled={!payoutAvailable || busy}
              className="bg-primary text-primary-foreground hover:bg-primary/90 w-fit rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy ? "Working…" : "Pay invoice"}
            </button>
          </Form>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function StateTable({
  rows,
}: {
  rows: Array<{ currentState: string; count: number }>;
}) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">No rows.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="p-2 text-left font-medium">State</th>
            <th className="p-2 text-right font-medium">Count</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.currentState} className="border-b last:border-0">
              <td className="p-2 font-mono text-xs">{r.currentState}</td>
              <td className="p-2 text-right tabular-nums">{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
