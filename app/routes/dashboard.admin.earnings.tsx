import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

/**
 * Legacy URL: earnings admin merged into Referrals tab.
 */
export function loader({ request }: LoaderFunctionArgs) {
  const u = new URL(request.url);
  u.pathname = "/dashboard/admin/referrals";
  if (!u.searchParams.has("section")) {
    u.searchParams.set("section", "ledger");
  }
  return redirect(u.toString());
}

export default function AdminEarningsRedirect() {
  return null;
}
