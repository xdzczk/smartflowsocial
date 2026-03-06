import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useSearchParams } from "@remix-run/react";

import { requireUser } from "~/features/auth";
import {
  getEarningsAdmin,
  isReferralAdmin,
  earningsToCsv,
  retryFailedPayout,
} from "~/features/referral/referral-admin.server";

interface AdminEarningsRow {
  id: string;
  referrerNpub: string;
  referredNpub: string;
  paymentId: string;
  commissionSats: number;
  status: string;
  payoutFailureReason: string | null;
  createdAt: string;
  paidAt: string | null;
}

interface AdminEarningsLoaderSuccess {
  earnings: AdminEarningsRow[];
  total: number;
  page: number;
  pageSize: number;
}

function isEarningsSuccess(
  d: { error?: string } | AdminEarningsLoaderSuccess
): d is AdminEarningsLoaderSuccess {
  return !("error" in d);
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (!isReferralAdmin(user.npub)) {
    return json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const exportCsv = url.searchParams.get("export") === "csv";
  const referrerNpub = url.searchParams.get("referrer_npub") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const dateFrom = url.searchParams.get("date_from") ?? undefined;
  const dateTo = url.searchParams.get("date_to") ?? undefined;
  const page = url.searchParams.get("page");
  const pageNum = page ? Math.max(1, parseInt(page, 10)) : 1;

  const result = await getEarningsAdmin({
    referrerNpub,
    status,
    dateFrom,
    dateTo,
    page: pageNum,
  });

  if (exportCsv) {
    const csv = earningsToCsv(result.earnings);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="referral_earnings.csv"',
      },
    });
  }

  const payload: AdminEarningsLoaderSuccess = {
    earnings: result.earnings.map(
      (e): AdminEarningsRow => ({
        id: e.id,
        referrerNpub: e.referrerNpub,
        referredNpub: e.referredNpub,
        paymentId: e.paymentId,
        commissionSats: e.commissionSats,
        status: e.status,
        payoutFailureReason: e.payoutFailureReason,
        createdAt: e.createdAt.toISOString(),
        paidAt: e.paidAt?.toISOString() ?? null,
      })
    ),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  };
  return json(payload);
}

export async function action({ request }: ActionFunctionArgs) {
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

  return json({ error: "Invalid action" }, { status: 400 });
}

type AdminEarningsLoaderData = { error?: string } | AdminEarningsLoaderSuccess;

export default function AdminEarningsPage() {
  const data = useLoaderData<typeof loader>() as AdminEarningsLoaderData;
  const [searchParams] = useSearchParams();

  if (!isEarningsSuccess(data)) {
    return <div className="p-4">Access denied.</div>;
  }

  const { earnings, total, page, pageSize } = data;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="mx-auto max-w-6xl p-4">
      <h1 className="text-2xl font-bold">Referral earnings (Admin)</h1>
      <p className="text-muted-foreground text-sm">
        Total: {total}. Page {page} of {totalPages || 1}.
      </p>
      <div className="mt-4 flex gap-2">
        <Link
          to="/dashboard/admin/referrals"
          className="text-primary hover:underline"
        >
          View referrals
        </Link>
        <a
          href={`?${new URLSearchParams([...searchParams.entries(), ["export", "csv"]]).toString()}`}
          className="text-primary hover:underline"
        >
          Export CSV
        </a>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">Referrer</th>
              <th className="p-2 text-left">Referred</th>
              <th className="p-2 text-right">Commission</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Created</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {earnings.map((e: AdminEarningsRow) => (
              <tr key={e.id} className="border-b">
                <td className="max-w-[120px] truncate p-2 font-mono text-xs">
                  {e.referrerNpub}
                </td>
                <td className="max-w-[120px] truncate p-2 font-mono text-xs">
                  {e.referredNpub}
                </td>
                <td className="p-2 text-right">{e.commissionSats} sats</td>
                <td className="p-2">
                  {e.status}
                  {e.payoutFailureReason ? ` (${e.payoutFailureReason})` : ""}
                </td>
                <td className="p-2">{e.createdAt}</td>
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
                        className="text-primary text-xs hover:underline"
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
    </div>
  );
}
