import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";

import { requireUser } from "~/features/auth";
import {
  getReferralsAdmin,
  isReferralAdmin,
  referralsToCsv,
} from "~/features/referral/referral-admin.server";

interface AdminReferralRow {
  referrerNpub: string;
  referredNpub: string;
  createdAt: string;
}

interface AdminReferralsLoaderSuccess {
  referrals: AdminReferralRow[];
  total: number;
  page: number;
  pageSize: number;
}

function isReferralsSuccess(
  d: { error?: string } | AdminReferralsLoaderSuccess
): d is AdminReferralsLoaderSuccess {
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
  const referredNpub = url.searchParams.get("referred_npub") ?? undefined;
  const dateFrom = url.searchParams.get("date_from") ?? undefined;
  const dateTo = url.searchParams.get("date_to") ?? undefined;
  const page = url.searchParams.get("page");
  const pageNum = page ? Math.max(1, parseInt(page, 10)) : 1;

  const result = await getReferralsAdmin({
    referrerNpub,
    referredNpub,
    dateFrom,
    dateTo,
    page: pageNum,
  });

  if (exportCsv) {
    const csv = referralsToCsv(result.referrals);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="referrals.csv"',
      },
    });
  }

  const payload: AdminReferralsLoaderSuccess = {
    referrals: result.referrals.map(
      (r): AdminReferralRow => ({
        referrerNpub: r.referrerNpub,
        referredNpub: r.referredNpub,
        createdAt: r.createdAt.toISOString(),
      })
    ),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  };
  return json(payload);
}

type AdminReferralsLoaderData =
  | { error?: string }
  | AdminReferralsLoaderSuccess;

export default function AdminReferralsPage() {
  const data = useLoaderData<typeof loader>() as AdminReferralsLoaderData;
  const [searchParams] = useSearchParams();

  if (!isReferralsSuccess(data)) {
    return <div className="p-4">Access denied.</div>;
  }

  const { referrals, total, page, pageSize } = data;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="mx-auto max-w-5xl p-4">
      <h1 className="text-2xl font-bold">Referrals (Admin)</h1>
      <p className="text-muted-foreground text-sm">
        Total: {total}. Page {page} of {totalPages || 1}.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/dashboard/admin" className="text-primary hover:underline">
          Admin overview
        </Link>
        <Link
          to="/dashboard/admin/earnings"
          className="text-primary hover:underline"
        >
          View earnings
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
              <th className="p-2 text-left">Referrer npub</th>
              <th className="p-2 text-left">Referred npub</th>
              <th className="p-2 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {referrals.map((r: AdminReferralRow) => (
              <tr key={r.referredNpub} className="border-b">
                <td className="p-2 font-mono text-xs">{r.referrerNpub}</td>
                <td className="p-2 font-mono text-xs">{r.referredNpub}</td>
                <td className="p-2">{r.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
