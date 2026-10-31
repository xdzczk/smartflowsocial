import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { loadPostAnalyticsPage } from "~/features/analytics/load-post-analytics.server";
import { PostAnalyticsPage } from "~/features/analytics/PostAnalyticsPage";
import { requireUserId } from "~/features/auth";
import {
  isSubscriptionActiveForGating,
  requireAnySubscription,
} from "~/features/payments";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  const url = new URL(request.url);
  const selected = url.searchParams.get("event")?.trim() ?? "";
  const data = await loadPostAnalyticsPage({
    userId,
    collectionActive: await isSubscriptionActiveForGating(userId),
    selectedEventId: selected.length > 0 ? selected : null,
  });
  return json(data);
}

export default function DashboardPostAnalyticsRoute() {
  const data = useLoaderData<typeof loader>();
  return <PostAnalyticsPage data={data} />;
}
