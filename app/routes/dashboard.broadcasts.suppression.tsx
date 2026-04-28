import { BroadcastSuppressionReasonCode } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { useState } from "react";

import { RecipientPicker } from "~/components/broadcast/audience/RecipientPicker";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { NativeCheckbox } from "~/components/ui/native-checkbox";
import { requireUserId } from "~/features/auth";
import {
  addBroadcastSuppression,
  listBroadcastSavedAudiences,
  listSuppressionsByUser,
  removeBroadcastSuppression,
} from "~/features/broadcast";
import { fetchBroadcastRecipientProfiles } from "~/features/broadcast/broadcast-recipient-picker.server";
import {
  campaignFieldClassNames,
  campaignSelectClassNames,
} from "~/features/campaign-ui";
import { requireAnySubscription } from "~/features/payments";
import { PublishingPageHeader } from "~/features/posts/ui";
import { formatNpubShort } from "~/lib/nostr-conversion";

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

  const url = new URL(request.url);
  const notice = url.searchParams.get("notice");
  const [rows, savedAudiences] = await Promise.all([
    listSuppressionsByUser(userId),
    listBroadcastSavedAudiences(userId),
  ]);
  const profiles = await fetchBroadcastRecipientProfiles(
    rows.map((r) => r.recipientPubkey)
  );
  const profileMap = Object.fromEntries(
    profiles.map((p) => [p.pubkey.toLowerCase(), p])
  );
  return json({ rows, notice, savedAudiences, profileMap });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);

  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "add") {
    const rawList = String(form.get("recipientPubkeys") ?? "");
    const pubkeys = rawList
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
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
    for (const pubkey of pubkeys) {
      await addBroadcastSuppression(userId, pubkey, {
        reason: typeof reason === "string" ? reason : undefined,
        reasonCode,
        permanent,
        expiresAt: permanent ? null : expiresAt,
      });
    }
    return redirect("/dashboard/broadcasts/suppression");
  }

  if (intent === "remove") {
    const pubkey = String(form.get("recipientPubkey") ?? "").trim();
    await removeBroadcastSuppression(userId, pubkey);
    return redirect("/dashboard/broadcasts/suppression");
  }

  return json({ error: "Unknown intent" }, { status: 400 });
}

export default function BroadcastSuppressionRoute() {
  const { rows, notice, savedAudiences, profileMap } =
    useLoaderData<typeof loader>();
  const [selectedPubkeys, setSelectedPubkeys] = useState<string[]>([]);

  return (
    <div className="w-full min-w-0 space-y-8">
      {notice ? (
        <div
          role="status"
          className="border-success/40 bg-success/10 text-success-text rounded-md border px-3 py-2 text-sm"
        >
          {notice}{" "}
          <Link
            to="/dashboard/broadcasts/suppression"
            className="text-text-secondary text-xs underline"
          >
            Dismiss
          </Link>
        </div>
      ) : null}
      <PublishingPageHeader
        title="Suppression list"
        subtitle="Suppressed recipients are excluded from every broadcast based on opt-out, policy, or import rules."
      />

      <section className="border-border bg-surface shadow-1 rounded-xl border p-4">
        <h2 className="font-medium">Add suppressions</h2>
        <Form method="post" className="mt-3 space-y-3">
          <input type="hidden" name="intent" value="add" />
          <input
            type="hidden"
            name="recipientPubkeys"
            value={selectedPubkeys.join("\n")}
          />
          <RecipientPicker
            savedAudiences={savedAudiences.map((s) => ({
              id: s.id,
              name: s.name,
              audienceType: s.audienceType,
              lastResolvedSize: s.lastResolvedSize,
              updatedAt: s.updatedAt,
            }))}
            selectedPubkeys={selectedPubkeys}
            onChangeSelected={setSelectedPubkeys}
          />
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
              className={campaignSelectClassNames}
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
              className={campaignFieldClassNames}
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <label
              htmlFor="broadcast-suppression-permanent"
              className="cluster text-sm"
            >
              <NativeCheckbox
                id="broadcast-suppression-permanent"
                name="permanent"
                defaultChecked
              />
              Permanent
            </label>
            <label className="cluster text-sm">
              <span className="text-text-secondary">Or expire after</span>
              <input
                type="datetime-local"
                name="expiresAt"
                className={campaignFieldClassNames}
              />
            </label>
          </div>
          <Button type="submit" disabled={selectedPubkeys.length === 0}>
            Add{" "}
            {selectedPubkeys.length > 0 ? `(${selectedPubkeys.length})` : ""}
          </Button>
        </Form>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Active suppressions</h2>
        <div className="border-border bg-surface shadow-1 overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-hover/50 border-b text-xs font-medium">
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
                    className="text-text-secondary px-3 py-4 text-sm"
                  >
                    No suppressions.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">
                      {(() => {
                        const p = profileMap[r.recipientPubkey.toLowerCase()];
                        const label =
                          p?.name ?? formatNpubShort(r.recipientPubkey);
                        return (
                          <div className="cluster" title={r.recipientPubkey}>
                            <Avatar className="h-6 w-6">
                              <AvatarImage
                                src={p?.picture ?? undefined}
                                alt={label}
                              />
                              <AvatarFallback>
                                {label.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium">
                                {label}
                              </p>
                              <p className="text-text-secondary truncate font-mono text-[11px]">
                                {formatNpubShort(r.recipientPubkey)}
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="text-text-secondary max-w-[160px] truncate px-3 py-2 text-xs">
                      {r.reason ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {REASON_LABELS[r.reasonCode]}
                    </td>
                    <td className="text-text-secondary px-3 py-2 text-xs">
                      {r.source}
                    </td>
                    <td className="text-text-secondary px-3 py-2 text-xs whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="text-text-secondary px-3 py-2 text-xs whitespace-nowrap">
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
                          className="text-danger text-xs hover:underline"
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
