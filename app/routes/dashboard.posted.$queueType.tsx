/**
 * Redirect: /dashboard/posted/:queueType -> /dashboard/published/:queueType
 * Keeps old bookmarks and links working.
 */
import { redirect } from "@remix-run/node";

export async function loader({ params }: { params: { queueType?: string } }) {
  const queueType = params.queueType ?? "all";
  return redirect(`/dashboard/published/${queueType}`, 302);
}

export default function DashboardPostedQueueRedirect() {
  return null;
}
