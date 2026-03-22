import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import {
  formatBroadcastAudienceLabel,
  getBroadcastCampaignForUser,
} from "~/features/broadcast";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "broadcasts");

  const id = params["id"];
  if (!id) {
    throw new Response("Not found", { status: 404 });
  }

  const campaign = await getBroadcastCampaignForUser(id, userId);
  if (!campaign) {
    throw new Response("Not found", { status: 404 });
  }

  return json({ campaign });
}

export default function BroadcastDetailRoute() {
  const { campaign } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/dashboard/broadcasts"
            className="text-muted-foreground text-sm hover:underline"
          >
            ← All broadcasts
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {campaign.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {campaign.status} ·{" "}
            {formatBroadcastAudienceLabel(
              campaign.audienceType,
              campaign.totalRecipients
            )}
          </p>
        </div>
      </div>

      <section className="border-border rounded-lg border p-4">
        <h2 className="font-medium">Message</h2>
        <p className="mt-2 text-sm whitespace-pre-wrap">
          {campaign.messageBody}
        </p>
      </section>

      <section className="border-border rounded-lg border p-4">
        <h2 className="font-medium">Stats</h2>
        <ul className="text-muted-foreground mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <li>Total: {campaign.totalRecipients}</li>
          <li>Sent: {campaign.sentCount}</li>
          <li>Failed: {campaign.failedCount}</li>
          <li>Suppressed: {campaign.suppressedCount}</li>
          <li>Queued: {campaign.queuedCount}</li>
        </ul>
      </section>

      <section className="border-border rounded-lg border p-4">
        <h2 className="mb-2 font-medium">Activity</h2>
        <ul className="divide-border max-h-64 divide-y overflow-y-auto text-sm">
          {campaign.eventLogs.map((log) => (
            <li key={log.id} className="py-2">
              <span className="text-muted-foreground text-xs">
                {new Date(log.createdAt).toLocaleString()}
              </span>{" "}
              <span className="font-medium">{log.eventType}</span>
              <div className="text-muted-foreground">{log.message}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-border rounded-lg border p-4">
        <h2 className="mb-2 font-medium">Recipients</h2>
        <div className="max-h-80 overflow-y-auto font-mono text-xs">
          {campaign.recipients.map((r) => (
            <div key={r.id} className="border-border flex border-b py-1">
              <span className="w-24 shrink-0">{r.status}</span>
              <span className="truncate">{r.recipientPubkey}</span>
              {r.failureReason ? (
                <span className="text-destructive ml-2 truncate">
                  {r.failureReason}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
