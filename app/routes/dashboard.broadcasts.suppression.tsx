import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import {
  addBroadcastSuppression,
  listSuppressionsByUser,
  removeBroadcastSuppression,
} from "~/features/broadcast";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "broadcasts");

  const rows = await listSuppressionsByUser(userId);
  return json({ rows });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "broadcasts");

  const form = await request.formData();
  const intent = form.get("intent");
  const pubkey = String(form.get("recipientPubkey") ?? "").trim();

  if (intent === "add") {
    const reason =
      typeof form.get("reason") === "string" ? form.get("reason") : "";
    await addBroadcastSuppression(
      userId,
      pubkey,
      typeof reason === "string" ? reason : undefined
    );
    return redirect("/dashboard/broadcasts/suppression");
  }
  if (intent === "remove") {
    await removeBroadcastSuppression(userId, pubkey);
    return redirect("/dashboard/broadcasts/suppression");
  }
  return json({ error: "Unknown intent" }, { status: 400 });
}

export default function BroadcastSuppressionRoute() {
  const { rows } = useLoaderData<typeof loader>();

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Suppression list
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Recipients on this list are excluded from every broadcast.
        </p>
      </div>

      <Form method="post" className="space-y-3">
        <input type="hidden" name="intent" value="add" />
        <div>
          <label
            htmlFor="broadcast-suppression-pubkey"
            className="mb-1 block text-sm font-medium"
          >
            Recipient pubkey (hex)
          </label>
          <input
            id="broadcast-suppression-pubkey"
            name="recipientPubkey"
            required
            className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-sm"
            placeholder="64-char hex"
          />
        </div>
        <div>
          <label
            htmlFor="broadcast-suppression-reason"
            className="mb-1 block text-sm font-medium"
          >
            Reason (optional)
          </label>
          <input
            id="broadcast-suppression-reason"
            name="reason"
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
        >
          Add
        </button>
      </Form>

      <ul className="divide-border border-border divide-y rounded-lg border">
        {rows.length === 0 ? (
          <li className="text-muted-foreground p-4 text-sm">
            No suppressions.
          </li>
        ) : (
          rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 p-3"
            >
              <div>
                <div className="font-mono text-xs">{r.recipientPubkey}</div>
                {r.reason ? (
                  <div className="text-muted-foreground text-xs">
                    {r.reason}
                  </div>
                ) : null}
              </div>
              <Form method="post">
                <input type="hidden" name="intent" value="remove" />
                <input
                  type="hidden"
                  name="recipientPubkey"
                  value={r.recipientPubkey}
                />
                <button
                  type="submit"
                  className="text-destructive text-sm hover:underline"
                >
                  Remove
                </button>
              </Form>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
