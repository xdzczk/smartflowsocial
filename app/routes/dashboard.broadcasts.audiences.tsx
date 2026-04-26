import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { defer, json, redirect } from "@remix-run/node";
import {
  Await,
  Form,
  Link,
  useLoaderData,
  useSearchParams,
} from "@remix-run/react";
import { Suspense, useState } from "react";

import { RecipientPicker } from "~/components/broadcast/audience/RecipientPicker";
import { BroadcastAudiencesPageSkeleton } from "~/components/broadcast/BroadcastAudiencesPageSkeleton";
import { DeferredRouteAwaitError } from "~/components/deferred-route/DeferredRouteAwaitError";
import { Button } from "~/components/ui/button";
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
  campaignFieldClassNames,
  campaignSelectClassNames,
} from "~/features/campaign-ui";
import { requireAnySubscription } from "~/features/payments";
import { PublishingPageHeader } from "~/features/posts/ui";
import { isRemixResourceRequest } from "~/lib/remix/is-remix-resource-request";
import { cn } from "~/lib/utils";

const BROADCAST_AUDIENCES_PATH = "/dashboard/broadcasts/audiences";

const VALID_SAVED_AUDIENCE_TYPES = ["CUSTOM", "MUTUALS"] as const;
const ERR_INVALID_AUDIENCE = "Invalid audience";
const ERR_MISSING_ID = "Missing id";

interface BroadcastAudiencesLoaderData {
  rows: Awaited<ReturnType<typeof listBroadcastSavedAudiences>>;
  notice: string | null;
  editingRow:
    | Awaited<ReturnType<typeof listBroadcastSavedAudiences>>[number]
    | null;
}

function audienceTypeBadgeClass(t: string): string {
  switch (t) {
    case "MUTUALS":
      return "bg-success/15 text-success-text";
    case "FOLLOWERS":
      return "bg-warning/15 text-warning-text";
    case "CUSTOM":
      return "bg-info/15 text-info-text";
    default:
      return "bg-surface-hover text-text-secondary";
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);

  const url = new URL(request.url);
  const notice = url.searchParams.get("notice");
  const editId = url.searchParams.get("edit");

  const audiencesPromise = (async (): Promise<BroadcastAudiencesLoaderData> => {
    const rows = await listBroadcastSavedAudiences(userId);
    const editingRow =
      editId && rows.some((r) => r.id === editId)
        ? (rows.find((r) => r.id === editId) ?? null)
        : null;
    return { rows, notice, editingRow };
  })();

  if (isRemixResourceRequest(request)) {
    return json(await audiencesPromise);
  }

  return defer<{ audiences: Promise<BroadcastAudiencesLoaderData> }>({
    audiences: audiencesPromise,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);

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
  const { audiences } = useLoaderData<{
    audiences: Promise<BroadcastAudiencesLoaderData>;
  }>();
  return (
    <Suspense fallback={<BroadcastAudiencesPageSkeleton />}>
      <Await
        resolve={audiences}
        errorElement={
          <DeferredRouteAwaitError retryTo="/dashboard/broadcasts/audiences" />
        }
      >
        {(loaded) => (
          <BroadcastAudiencesRouteLoaded
            rows={(loaded as BroadcastAudiencesLoaderData).rows}
            notice={(loaded as BroadcastAudiencesLoaderData).notice}
            editingRow={(loaded as BroadcastAudiencesLoaderData).editingRow}
          />
        )}
      </Await>
    </Suspense>
  );
}

function BroadcastAudiencesRouteLoaded({
  rows,
  notice,
  editingRow,
}: {
  rows: Awaited<ReturnType<typeof listBroadcastSavedAudiences>>;
  notice: string | null;
  editingRow:
    | Awaited<ReturnType<typeof listBroadcastSavedAudiences>>[number]
    | null;
}) {
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

  /** Always boolean — never `null` (React `disabled` is boolean | undefined only). */
  const disableEditAudienceSubmit: boolean =
    editAudienceType === "CUSTOM" && editSelectedPubkeys.length === 0;
  const disableCreateAudienceSubmit: boolean =
    createAudienceType === "CUSTOM" && createSelectedPubkeys.length === 0;

  return (
    <div className="w-full min-w-0 space-y-8">
      <PublishingPageHeader
        title="Audiences"
        subtitle="Save audience definitions to reuse in new broadcasts. Graph-based types (mutuals) resolve at send time; custom lists are filtered to followers at send time."
      />

      {notice === "saved" ? (
        <div
          role="status"
          className="border-success/40 bg-success/10 text-success-text rounded-md border px-3 py-2 text-sm"
        >
          Audience saved.
        </div>
      ) : null}

      {editingRow ? (
        <section
          key={editingRow.id}
          className="border-border bg-surface shadow-1 rounded-xl border p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">Edit audience</h2>
            <button
              type="button"
              className="text-text-secondary text-xs hover:underline"
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
                className={campaignFieldClassNames}
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
                className={campaignSelectClassNames}
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
                  updatedAt: r.updatedAt.toISOString(),
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
                className={campaignFieldClassNames}
              />
            </div>
            <Button type="submit" disabled={disableEditAudienceSubmit}>
              Save changes
            </Button>
          </Form>
        </section>
      ) : null}

      <section className="border-border bg-surface shadow-1 rounded-xl border p-4">
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
              className={campaignFieldClassNames}
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
              className={campaignSelectClassNames}
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
                updatedAt: r.updatedAt.toISOString(),
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
              className={campaignFieldClassNames}
            />
          </div>
          <Button type="submit" disabled={disableCreateAudienceSubmit}>
            Save audience
          </Button>
        </Form>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Saved audiences</h2>
        <div className="border-border bg-surface shadow-1 overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-hover/50 border-b text-xs font-medium">
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
                    className="text-text-secondary px-3 py-6 text-center text-sm"
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
                    <td className="text-text-secondary max-w-[200px] truncate px-3 py-2 text-xs">
                      {r.ruleSummary ??
                        formatBroadcastAudienceLabel(
                          r.audienceType,
                          r.customNpubLines.length
                        )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {r.lastResolvedSize ?? "—"}
                    </td>
                    <td className="text-text-secondary px-3 py-2 text-xs whitespace-nowrap">
                      {new Date(r.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/dashboard/broadcasts/new?savedAudienceId=${encodeURIComponent(r.id)}`}
                          className="text-brand text-xs font-medium hover:underline"
                        >
                          Use
                        </Link>
                        <Link
                          to={`${BROADCAST_AUDIENCES_PATH}?edit=${encodeURIComponent(r.id)}`}
                          className="text-brand text-xs font-medium hover:underline"
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
                            className="text-brand text-xs font-medium hover:underline"
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
                            className="text-brand text-xs font-medium hover:underline"
                          >
                            Refresh estimate
                          </button>
                        </Form>
                        <Form method="post" className="inline">
                          <input type="hidden" name="intent" value="delete" />
                          <input type="hidden" name="id" value={r.id} />
                          <button
                            type="submit"
                            className="text-danger text-xs hover:underline"
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
