/**
 * Redirect: /dashboard/posted -> /dashboard/published
 * Keeps old bookmarks and links working.
 */
import { redirect } from "@remix-run/node";

export async function loader() {
  return redirect("/dashboard/published", 302);
}

export default function DashboardPostedRedirect() {
  return null;
}
