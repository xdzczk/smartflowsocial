import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { useState } from "react";

import { RecipientPicker } from "~/components/broadcast/audience/RecipientPicker";
import { requireUserId } from "~/features/auth";
import {
  createBroadcastSavedAudience,
  deleteBroadcastSavedAudience,
  duplicateBroadcastSavedAudience,
  formatBroadcastAudienceLabel,
  getBroadcastCampaignForUser,
  listBroadcastSavedAudiences,
  refreshSavedAudienceEstimate,
  updateBroadcastSavedAudience,
} from "~/features/broadcast";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import { cn } from "~/lib/utils";

const BROADCAST_AUDIENCES_PATH = "/dashboard/broadcasts/audiences";

const VALID_SAVED_AUDIENCE_TYPES = ["CUSTOM", "MUTUALS"] as const;
const ERR_INVALID_AUDIENCE = "Invalid audience";
const ERR_MISSING_ID = "Missing id";

function audienceTypeBadgeClass(t: string): string {
  switch (t) {
    case "MUTUALS":
      return "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
    case "FOLLOWERS":
      return "bg-amber-500/15 text-amber-950 dark:text-amber-100";
    case "CUSTOM":
      return "bg-blue-500/15 text-blue-950 dark:text-blue-100";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "broadcasts");

  const url = new URL(request.url);
  const notice = url.searchParams.get("notice");
  const editId = url.searchParams.get("edit");

  const rows = await listBroadcastSavedAudiences(userId);
  const editingRow =
    editId && rows.some((r) => r.id === editId)
      ? (rows.find((r) => r.id === editId) ?? null)
      : null;

  return json({ rows, notice, editingRow });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "broadcasts");

  const form = await request.formData();
  const intent = form.get("intent");

  const splitCustom = (raw: string) =>
    raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

  if (intent === "create") {
    const name = String(form.get("name") ?? "").trim();
    const audienceType = String(form.get("audienceType") ?? "CUSTOM");
    const customRaw = String(form.get("customNpubs") ?? "");
    const customNpubLines = splitCustom(customRaw);
    const ruleSummary = String(form.get("ruleSummary") ?? "").trim();
    if (!name) {
      return json({ error: "Name required" }, { status: 400 });
    }
    if (
      !VALID_SAVED_AUDIENCE_TYPES.includes(
        audienceType as (typeof VALID_SAVED_AUDIENCE_TYPES)[number]
      )
    ) {
      return json({ error: ERR_INVALID_AUDIENCE }, { status: 400 });
    }
    await createBroadcastSavedAudience(userId, {
      name,
      audienceType: audienceType as "CUSTOM" | "MUTUALS",
      customNpubLines,
      ruleSummary: ruleSummary || undefined,
    });
    return redirect(BROADCAST_AUDIENCES_PATH);
  }

  if (intent === "update") {
    const id = String(form.get("id") ?? "");
    const name = String(form.get("name") ?? "").trim();
    const audienceType = String(form.get("audienceType") ?? "CUSTOM");
    const customRaw = String(form.get("customNpubs") ?? "");
    const customNpubLines = splitCustom(customRaw);
    const ruleSummary = String(form.get("ruleSummary") ?? "").trim();
    if (!id) return json({ error: ERR_MISSING_ID }, { status: 400 });
    if (!name) {
      return json({ error: "Name required" }, { status: 400 });
    }
    if (
      !VALID_SAVED_AUDIENCE_TYPES.includes(
        audienceType as (typeof VALID_SAVED_AUDIENCE_TYPES)[number]
      )
    ) {
      return json({ error: ERR_INVALID_AUDIENCE }, { status: 400 });
    }
    await updateBroadcastSavedAudience(userId, id, {
      name,
      audienceType: audienceType as "CUSTOM" | "MUTUALS",
      customNpubLines,
      ruleSummary: ruleSummary || null,
    });
    return redirect(BROADCAST_AUDIENCES_PATH);
  }

  if (intent === "duplicate") {
    const id = String(form.get("id") ?? "");
    if (!id) return json({ error: ERR_MISSING_ID }, { status: 400 });
    const { id: newId } = await duplicateBroadcastSavedAudience(userId, id);
    return redirect(
      `${BROADCAST_AUDIENCES_PATH}?edit=${encodeURIComponent(newId)}`
    );
  }

  if (intent === "refresh_estimate") {
    const id = String(form.get("id") ?? "");
    if (!id) return json({ error: ERR_MISSING_ID }, { status: 400 });
    await refreshSavedAudienceEstimate(userId, id);
    return redirect(BROADCAST_AUDIENCES_PATH);
  }

  if (intent === "save_from_review") {
    const campaignId = String(form.get("campaignId") ?? "");
    const name = String(form.get("name") ?? "").trim();
    if (!campaignId) {
      return json({ error: "Missing campaign" }, { status: 400 });
    }
    const campaign = await getBroadcastCampaignForUser(campaignId, userId);
    if (!campaign) {
      return json({ error: "Campaign not found" }, { status: 404 });
    }
    if (campaign.audienceType === "FOLLOWING") {
      return json(
        { error: "This audience type cannot be saved" },
        { status: 400 }
      );
    }
    if (campaign.audienceType === "FOLLOWERS") {
      return json(
        { error: "This audience type cannot be saved" },
        { status: 400 }
      );
    }
    await createBroadcastSavedAudience(userId, {
      name: name || campaign.name,
      audienceType: campaign.audienceType,
      customNpubLines: campaign.customNpubLines,
      ruleSummary: "Saved from broadcast review",
    });
    return redirect(`${BROADCAST_AUDIENCES_PATH}?notice=saved`);
  }

  if (intent === "delete") {
    const id = String(form.get("id") ?? "");
    if (!id) return json({ error: ERR_MISSING_ID }, { status: 400 });
    await deleteBroadcastSavedAudience(userId, id);
    return redirect(BROADCAST_AUDIENCES_PATH);
  }

  return json({ error: "Unknown intent" }, { status: 400 });
}

export default function BroadcastAudiencesRoute() {
  const { rows, notice, editingRow } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();
  const [editAudienceType, setEditAudienceType] = useState<
    "CUSTOM" | "MUTUALS"
  >(editingRow?.audienceType === "MUTUALS" ? "MUTUALS" : "CUSTOM");
  const [editSelectedPubkeys, setEditSelectedPubkeys] = useState<string[]>(
    editingRow?.audienceType === "CUSTOM" ? editingRow.customNpubLines : []
  );
  const [createAudienceType, setCreateAudienceType] = useState("CUSTOM");
  const [createSelectedPubkeys, setCreateSelectedPubkeys] = useState<string[]>(
    []
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audiences</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Save audience definitions to reuse in new broadcasts. Graph-based
          types (mutuals) resolve at send time; custom lists are filtered to
          followers at send time.
        </p>
      </div>

      {notice === "saved" ? (
        <div
          role="status"
          className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-950 dark:text-emerald-100"
        >
          Audience saved.
        </div>
      ) : null}

      {editingRow ? (
        <section
          key={editingRow.id}
          className="border-border rounded-lg border p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">Edit audience</h2>
            <button
              type="button"
              className="text-muted-foreground text-xs hover:underline"
              onClick={() => {
                setSearchParams({});
              }}
            >
              Cancel edit
            </button>
          </div>
          <Form method="post" className="mt-4 space-y-3">
            <input type="hidden" name="intent" value="update" />
            <input type="hidden" name="id" value={editingRow.id} />
            <input
              type="hidden"
              name="customNpubs"
              value={editSelectedPubkeys.join("\n")}
            />
            <div>
              <label
                className="mb-1 block text-sm font-medium"
                htmlFor="aud-edit-name"
              >
                Name
              </label>
              <input
                id="aud-edit-name"
                name="name"
                required
                defaultValue={editingRow.name}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-sm font-medium"
                htmlFor="aud-edit-type"
              >
                Type
              </label>
              <select
                id="aud-edit-type"
                name="audienceType"
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                value={editAudienceType}
                onChange={(e) =>
                  setEditAudienceType(
                    e.target.value === "MUTUALS" ? "MUTUALS" : "CUSTOM"
                  )
                }
              >
                <option value="CUSTOM">Custom list</option>
                <option value="MUTUALS">Mutuals</option>
              </select>
            </div>
            {editAudienceType === "CUSTOM" ? (
              <RecipientPicker
                savedAudiences={rows.map((r) => ({
                  id: r.id,
                  name: r.name,
                  audienceType: r.audienceType,
                  lastResolvedSize: r.lastResolvedSize,
                  updatedAt: r.updatedAt,
                }))}
                selectedPubkeys={editSelectedPubkeys}
                onChangeSelected={setEditSelectedPubkeys}
              />
            ) : null}
            <div>
              <label
                className="mb-1 block text-sm font-medium"
                htmlFor="aud-edit-rule"
              >
                Rule summary (optional)
              </label>
              <input
                id="aud-edit-rule"
                name="ruleSummary"
                defaultValue={editingRow.ruleSummary ?? ""}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={
                editAudienceType === "CUSTOM"
                  ? editSelectedPubkeys.length === 0
                  : null
              }
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
            >
              Save changes
            </button>
          </Form>
        </section>
      ) : null}

      <section className="border-border rounded-lg border p-4">
        <h2 className="font-medium">Save new audience</h2>
        <Form method="post" className="mt-4 space-y-3">
          <input type="hidden" name="intent" value="create" />
          <input
            type="hidden"
            name="customNpubs"
            value={createSelectedPubkeys.join("\n")}
          />
          <div>
            <label
              className="mb-1 block text-sm font-medium"
              htmlFor="aud-name"
            >
              Name
            </label>
            <input
              id="aud-name"
              name="name"
              required
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium"
              htmlFor="aud-type"
            >
              Type
            </label>
            <select
              id="aud-type"
              name="audienceType"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              value={createAudienceType}
              onChange={(e) => setCreateAudienceType(e.target.value)}
            >
              <option value="CUSTOM">Custom list</option>
              <option value="MUTUALS">Mutuals</option>
            </select>
          </div>
          {createAudienceType === "CUSTOM" ? (
            <RecipientPicker
              savedAudiences={rows.map((r) => ({
                id: r.id,
                name: r.name,
                audienceType: r.audienceType,
                lastResolvedSize: r.lastResolvedSize,
                updatedAt: r.updatedAt,
              }))}
              selectedPubkeys={createSelectedPubkeys}
              onChangeSelected={setCreateSelectedPubkeys}
            />
          ) : null}
          <div>
            <label
              className="mb-1 block text-sm font-medium"
              htmlFor="aud-rule"
            >
              Rule summary (optional)
            </label>
            <input
              id="aud-rule"
              name="ruleSummary"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={
              createAudienceType === "CUSTOM"
                ? createSelectedPubkeys.length === 0
                : null
            }
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
          >
            Save audience
          </button>
        </Form>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Saved audiences</h2>
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b text-xs font-medium">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Summary</th>
                <th className="px-3 py-2">Last size</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-muted-foreground px-3 py-6 text-center text-sm"
                  >
                    No saved audiences yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase",
                          audienceTypeBadgeClass(r.audienceType)
                        )}
                      >
                        {r.audienceType}
                      </span>
                    </td>
                    <td className="text-muted-foreground max-w-[200px] truncate px-3 py-2 text-xs">
                      {r.ruleSummary ??
                        formatBroadcastAudienceLabel(
                          r.audienceType,
                          r.customNpubLines.length
                        )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {r.lastResolvedSize ?? "—"}
                    </td>
                    <td className="text-muted-foreground px-3 py-2 text-xs whitespace-nowrap">
                      {new Date(r.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/dashboard/broadcasts/new?savedAudienceId=${encodeURIComponent(r.id)}`}
                          className="text-primary text-xs font-medium hover:underline"
                        >
                          Use
                        </Link>
                        <Link
                          to={`${BROADCAST_AUDIENCES_PATH}?edit=${encodeURIComponent(r.id)}`}
                          className="text-primary text-xs font-medium hover:underline"
                        >
                          Edit
                        </Link>
                        <Form method="post" className="inline">
                          <input
                            type="hidden"
                            name="intent"
                            value="duplicate"
                          />
                          <input type="hidden" name="id" value={r.id} />
                          <button
                            type="submit"
                            className="text-primary text-xs font-medium hover:underline"
                          >
                            Duplicate
                          </button>
                        </Form>
                        <Form method="post" className="inline">
                          <input
                            type="hidden"
                            name="intent"
                            value="refresh_estimate"
                          />
                          <input type="hidden" name="id" value={r.id} />
                          <button
                            type="submit"
                            className="text-primary text-xs font-medium hover:underline"
                          >
                            Refresh estimate
                          </button>
                        </Form>
                        <Form method="post" className="inline">
                          <input type="hidden" name="intent" value="delete" />
                          <input type="hidden" name="id" value={r.id} />
                          <button
                            type="submit"
                            className="text-destructive text-xs hover:underline"
                          >
                            Delete
                          </button>
                        </Form>
                      </div>
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
