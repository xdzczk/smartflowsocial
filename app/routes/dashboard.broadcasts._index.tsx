import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import {
  cancelBroadcastCampaign,
  deleteBroadcastDraft,
  formatBroadcastAudienceLabel,
  listBroadcastCampaignsByUser,
} from "~/features/broadcast";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "broadcasts");

  const campaigns = await listBroadcastCampaignsByUser(userId);
  return json({ campaigns });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "broadcasts");

  const form = await request.formData();
  const intent = form.get("intent");
  const campaignId = form.get("campaignId");
  if (typeof campaignId !== "string" || !campaignId) {
    return json({ error: "Missing campaign" }, { status: 400 });
  }

  if (intent === "cancel") {
    await cancelBroadcastCampaign(userId, campaignId);
    return redirect("/dashboard/broadcasts");
  }
  if (intent === "delete") {
    await deleteBroadcastDraft(userId, campaignId);
    return redirect("/dashboard/broadcasts");
  }
  return json({ error: "Unknown intent" }, { status: 400 });
}

export default function BroadcastsIndexRoute() {
  const { campaigns } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Broadcasts</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Send private messages to selected audiences on Nostr. Schedule updates
          and community announcements with compatibility-aware delivery.
        </p>
      </div>

      {campaigns.length === 0 ? (
        <div className="border-border bg-muted/30 rounded-lg border border-dashed p-10 text-center">
          <p className="text-muted-foreground mb-4 text-sm">
            No broadcasts yet. Create one to reach your audience with signed
            direct messages.
          </p>
          <Link
            to="/dashboard/broadcasts/new"
            className="bg-primary text-primary-foreground inline-flex rounded-md px-4 py-2 text-sm font-medium"
          >
            Create broadcast
          </Link>
        </div>
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {campaigns.map((c) => (
            <li
              key={c.id}
              className="hover:bg-muted/40 flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div>
                <Link
                  to={`/dashboard/broadcasts/${c.id}`}
                  className="font-medium hover:underline"
                >
                  {c.name}
                </Link>
                <div className="text-muted-foreground mt-1 text-xs">
                  {c.status} ·{" "}
                  {formatBroadcastAudienceLabel(
                    c.audienceType,
                    c.totalRecipients
                  )}{" "}
                  · Sent {c.sentCount}/{c.totalRecipients}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/dashboard/broadcasts/${c.id}`}
                  className="text-primary text-sm font-medium"
                >
                  View
                </Link>
                {c.status === "DRAFT" ? (
                  <Form method="post">
                    <input type="hidden" name="campaignId" value={c.id} />
                    <button
                      type="submit"
                      name="intent"
                      value="delete"
                      className="text-destructive text-sm"
                    >
                      Delete draft
                    </button>
                  </Form>
                ) : null}
                {c.status === "SCHEDULED" ||
                c.status === "QUEUED" ||
                c.status === "SENDING" ? (
                  <Form method="post">
                    <input type="hidden" name="campaignId" value={c.id} />
                    <button
                      type="submit"
                      name="intent"
                      value="cancel"
                      className="text-sm text-amber-600 dark:text-amber-400"
                    >
                      Cancel
                    </button>
                  </Form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
