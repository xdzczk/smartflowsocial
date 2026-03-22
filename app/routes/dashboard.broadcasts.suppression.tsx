import { BroadcastSuppressionReasonCode } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import {
  addBroadcastSuppression,
  listSuppressionsByUser,
  removeBroadcastSuppression,
} from "~/features/broadcast";
import { shortHexPubkey } from "~/features/broadcast/broadcast-identity";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";

const REASON_LABELS: Record<BroadcastSuppressionReasonCode, string> = {
  MANUAL_OPT_OUT: "Manual opt-out",
  FAILED_REPEATEDLY: "Failed repeatedly",
  COMPLAINT_OR_ABUSE: "Complaint / abuse concern",
  DUPLICATE_PROTECTION: "Duplicate protection",
  IMPORTED: "Imported suppression",
  POLICY_BLOCK: "Policy block",
  OTHER: "Other",
};

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "broadcasts");

  const url = new URL(request.url);
  const notice = url.searchParams.get("notice");
  const rows = await listSuppressionsByUser(userId);
  return json({ rows, notice });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "broadcasts");

  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "add") {
    const pubkey = String(form.get("recipientPubkey") ?? "").trim();
    const reason =
      typeof form.get("reason") === "string" ? form.get("reason") : "";
    const reasonCodeRaw = String(form.get("reasonCode") ?? "OTHER");
    let permanent = form.get("permanent") === "on";
    const expiresAtRaw = String(form.get("expiresAt") ?? "").trim();
    if (!permanent && !expiresAtRaw) permanent = true;
    const expiresAt =
      expiresAtRaw && !permanent ? new Date(expiresAtRaw) : null;
    const reasonCode = Object.values(BroadcastSuppressionReasonCode).includes(
      reasonCodeRaw as BroadcastSuppressionReasonCode
    )
      ? (reasonCodeRaw as BroadcastSuppressionReasonCode)
      : BroadcastSuppressionReasonCode.OTHER;
    await addBroadcastSuppression(userId, pubkey, {
      reason: typeof reason === "string" ? reason : undefined,
      reasonCode,
      permanent,
      expiresAt: permanent ? null : expiresAt,
    });
    return redirect("/dashboard/broadcasts/suppression");
  }

  if (intent === "bulk_add") {
    const raw = String(form.get("bulkLines") ?? "");
    const lines = raw
      .split(/[\r\n,]+/)
      .map((l) => l.trim())
      .filter(Boolean);
    let added = 0;
    for (const line of lines) {
      try {
        await addBroadcastSuppression(userId, line, {
          reasonCode: BroadcastSuppressionReasonCode.IMPORTED,
          permanent: true,
        });
        added += 1;
      } catch {
        /* skip invalid */
      }
    }
    return redirect(
      `/dashboard/broadcasts/suppression?notice=${encodeURIComponent(
        `Imported ${String(added)} of ${String(lines.length)} entries.`
      )}`
    );
  }

  if (intent === "remove") {
    const pubkey = String(form.get("recipientPubkey") ?? "").trim();
    await removeBroadcastSuppression(userId, pubkey);
    return redirect("/dashboard/broadcasts/suppression");
  }

  return json({ error: "Unknown intent" }, { status: 400 });
}

export default function BroadcastSuppressionRoute() {
  const { rows, notice } = useLoaderData<typeof loader>();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {notice ? (
        <div
          role="status"
          className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-950 dark:text-emerald-100"
        >
          {notice}{" "}
          <Link
            to="/dashboard/broadcasts/suppression"
            className="text-muted-foreground text-xs underline"
          >
            Dismiss
          </Link>
        </div>
      ) : null}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Suppression list
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Suppressed recipients are excluded from every broadcast based on
          opt-out, policy, or import rules.
        </p>
      </div>

      <section className="border-border rounded-lg border p-4">
        <h2 className="font-medium">Add manually</h2>
        <Form method="post" className="mt-3 space-y-3">
          <input type="hidden" name="intent" value="add" />
          <div>
            <label
              htmlFor="broadcast-suppression-pubkey"
              className="mb-1 block text-sm font-medium"
            >
              Recipient npub or hex
            </label>
            <input
              id="broadcast-suppression-pubkey"
              name="recipientPubkey"
              required
              className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-sm"
              placeholder="npub1… or 64-char hex"
            />
          </div>
          <div>
            <label
              htmlFor="broadcast-suppression-reason-code"
              className="mb-1 block text-sm font-medium"
            >
              Reason type
            </label>
            <select
              id="broadcast-suppression-reason-code"
              name="reasonCode"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              {(
                Object.entries(REASON_LABELS) as Array<
                  [BroadcastSuppressionReasonCode, string]
                >
              ).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="broadcast-suppression-reason"
              className="mb-1 block text-sm font-medium"
            >
              Notes (optional)
            </label>
            <input
              id="broadcast-suppression-reason"
              name="reason"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="permanent" defaultChecked />
              Permanent
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Or expire after</span>
              <input
                type="datetime-local"
                name="expiresAt"
                className="border-input bg-background rounded-md border px-2 py-1 text-sm"
              />
            </label>
          </div>
          <button
            type="submit"
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
          >
            Add
          </button>
        </Form>
      </section>

      <section className="border-border rounded-lg border p-4">
        <h2 className="font-medium">Bulk import</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          One npub or hex per line or comma-separated. Invalid lines are
          skipped.
        </p>
        <Form method="post" className="mt-3 space-y-2">
          <input type="hidden" name="intent" value="bulk_add" />
          <textarea
            name="bulkLines"
            rows={6}
            className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-sm"
          />
          <button
            type="submit"
            className="border-input bg-background hover:bg-muted rounded-md border px-4 py-2 text-sm font-medium"
          >
            Import
          </button>
        </Form>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Active suppressions</h2>
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b text-xs font-medium">
              <tr>
                <th className="px-3 py-2">Recipient</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Added</th>
                <th className="px-3 py-2">Expires</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-muted-foreground px-3 py-4 text-sm"
                  >
                    No suppressions.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td
                      className="px-3 py-2 font-mono text-xs"
                      title={r.recipientPubkey}
                    >
                      {shortHexPubkey(r.recipientPubkey)}
                    </td>
                    <td className="text-muted-foreground max-w-[160px] truncate px-3 py-2 text-xs">
                      {r.reason ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {REASON_LABELS[r.reasonCode]}
                    </td>
                    <td className="text-muted-foreground px-3 py-2 text-xs">
                      {r.source}
                    </td>
                    <td className="text-muted-foreground px-3 py-2 text-xs whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="text-muted-foreground px-3 py-2 text-xs whitespace-nowrap">
                      {r.permanent
                        ? "Never"
                        : r.expiresAt
                          ? new Date(r.expiresAt).toLocaleString()
                          : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Form method="post">
                        <input type="hidden" name="intent" value="remove" />
                        <input
                          type="hidden"
                          name="recipientPubkey"
                          value={r.recipientPubkey}
                        />
                        <button
                          type="submit"
                          className="text-destructive text-xs hover:underline"
                        >
                          Remove
                        </button>
                      </Form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
