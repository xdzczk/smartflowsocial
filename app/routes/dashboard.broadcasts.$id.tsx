import { BroadcastSuppressionReasonCode } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { defer, json, redirect } from "@remix-run/node";
import {
  Await,
  Form,
  Link,
  useLoaderData,
  useRevalidator,
  useSearchParams,
} from "@remix-run/react";
import { Suspense, useEffect, useState } from "react";

import { BroadcastDetailPageSkeleton } from "~/components/broadcast/BroadcastDetailPageSkeleton";
import { DeferredRouteAwaitError } from "~/components/deferred-route/DeferredRouteAwaitError";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { requireUserId } from "~/features/auth";
import {
  addBroadcastSuppression,
  cancelBroadcastCampaign,
  duplicateBroadcastCampaign,
  formatBroadcastAudienceLabel,
  formatBroadcastCampaignStatus,
  formatBroadcastDeliveryMode,
  getBroadcastCampaignForUserWithRecipientSlice,
  retryBroadcastFailedRecipients,
} from "~/features/broadcast";
import { fetchBroadcastRecipientProfiles } from "~/features/broadcast/broadcast-recipient-picker.server";
import { broadcastStatusBadgeKind } from "~/features/broadcast/broadcast-status";
import { requireAnySubscription } from "~/features/payments";
import { formatNpubShort } from "~/lib/nostr-conversion";
import { isRemixResourceRequest } from "~/lib/remix/is-remix-resource-request";
import { cn } from "~/lib/utils";

async function getBroadcastDetailData({
  id,
  userId,
  statusFilter,
  search,
  take,
  skip,
  page,
}: {
  id: string;
  userId: string;
  statusFilter: string;
  search: string;
  take: number;
  skip: number;
  page: number;
}) {
  const bundle = await getBroadcastCampaignForUserWithRecipientSlice(
    id,
    userId,
    {
      status: statusFilter,
      search: search.trim() || undefined,
      take,
      skip,
    }
  );
  if (!bundle) throw new Response("Not found", { status: 404 });
  const profiles = await fetchBroadcastRecipientProfiles(
    bundle.recipients.map((r) => r.recipientPubkey)
  );
  const profileMap = Object.fromEntries(
    profiles.map((p) => [p.pubkey.toLowerCase(), p])
  );

  return { ...bundle, page, take, statusFilter, search, profileMap };
}

type BroadcastDetailLoaderData = Awaited<
  ReturnType<typeof getBroadcastDetailData>
>;

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);

  const id = params["id"];
  if (!id) throw new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("rstatus") ?? "ALL";
  const search = url.searchParams.get("rq") ?? "";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const take = 75;
  const skip = (page - 1) * take;

  const detailPromise = getBroadcastDetailData({
    id,
    userId,
    statusFilter,
    search,
    take,
    skip,
    page,
  });

  if (isRemixResourceRequest(request)) {
    return json(await detailPromise);
  }

  return defer<{ detail: Promise<BroadcastDetailLoaderData> }>({
    detail: detailPromise,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);

  const id = params["id"];
  if (!id) return json({ error: "Not found" }, { status: 404 });

  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "cancel") {
    await cancelBroadcastCampaign(userId, id);
    return redirect(`/dashboard/broadcasts/${id}`);
  }
  if (intent === "duplicate") {
    const { id: newId } = await duplicateBroadcastCampaign(userId, id);
    return redirect(
      `/dashboard/broadcasts/new?campaignId=${encodeURIComponent(newId)}`
    );
  }
  if (intent === "retry_failed") {
    const { id: newId } = await retryBroadcastFailedRecipients(userId, id);
    return redirect(
      `/dashboard/broadcasts/new/review?campaignId=${encodeURIComponent(newId)}`
    );
  }
  if (intent === "suppress") {
    const pk = String(form.get("pubkey") ?? "");
    await addBroadcastSuppression(userId, pk, {
      reason: String(form.get("reason") ?? "") || undefined,
      reasonCode: BroadcastSuppressionReasonCode.MANUAL_OPT_OUT,
      createdFromCampaignId: id,
    });
    return redirect(`/dashboard/broadcasts/${id}`);
  }
  if (intent === "export_csv") {
    const full = await getBroadcastCampaignForUserWithRecipientSlice(
      id,
      userId,
      { take: 5000, skip: 0 }
    );
    if (!full) return json({ error: "Not found" }, { status: 404 });
    const header = [
      "status",
      "recipientPubkey",
      "deliveryMethodUsed",
      "attemptCount",
      "sentAt",
      "failureCode",
      "failureReason",
    ].join(",");
    const lines = full.recipients.map((r) =>
      [
        r.status,
        r.recipientPubkey,
        r.deliveryMethodUsed ?? "",
        String(r.attemptCount),
        r.sentAt ? new Date(r.sentAt).toISOString() : "",
        r.failureCode ?? "",
        (r.failureReason ?? "").replaceAll('"', "'"),
      ]
        .map((c) => `"${String(c)}"`)
        .join(",")
    );
    const csv = [header, ...lines].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="broadcast-${id}.csv"`,
      },
    });
  }

  if (intent === "export_json") {
    const full = await getBroadcastCampaignForUserWithRecipientSlice(
      id,
      userId,
      { take: 5000, skip: 0 }
    );
    if (!full) return json({ error: "Not found" }, { status: 404 });
    const c = full.campaign;
    const payload = {
      exportedAt: new Date().toISOString(),
      campaign: {
        id: c.id,
        name: c.name,
        status: c.status,
        audienceType: c.audienceType,
        deliveryMode: c.deliveryMode,
        sendStrategy: c.sendStrategy,
        scheduledFor: c.scheduledFor,
        startedAt: c.startedAt,
        completedAt: c.completedAt,
        totalRecipients: c.totalRecipients,
        sentCount: c.sentCount,
        failedCount: c.failedCount,
        suppressedCount: c.suppressedCount,
        queuedCount: c.queuedCount,
      },
      recipients: full.recipients.map((r) => ({
        id: r.id,
        status: r.status,
        recipientPubkey: r.recipientPubkey,
        deliveryMethodUsed: r.deliveryMethodUsed,
        attemptCount: r.attemptCount,
        sentAt: r.sentAt,
        failureCode: r.failureCode,
        failureReason: r.failureReason,
        skipReason: r.skipReason,
      })),
    };
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="broadcast-${id}.json"`,
      },
    });
  }

  return json({ error: "Unknown intent" }, { status: 400 });
}

function badgeClass(kind: string) {
  switch (kind) {
    case "success":
      return "bg-success/15 text-success-text";
    case "danger":
      return "bg-danger/15 text-danger";
    case "warn":
      return "bg-warning/15 text-warning-text";
    case "info":
      return "bg-info/15 text-info-text";
    case "mixed":
      return "bg-brand/12 text-brand-text";
    default:
      return "bg-surface-hover text-text-secondary";
  }
}

export default function BroadcastDetailRoute() {
  const { detail } = useLoaderData<{
    detail: Promise<BroadcastDetailLoaderData>;
  }>();
  return (
    <Suspense fallback={<BroadcastDetailPageSkeleton />}>
      <Await
        resolve={detail}
        errorElement={
          <DeferredRouteAwaitError retryTo="/dashboard/broadcasts" />
        }
      >
        {(loaded) => (
          <BroadcastDetailRouteLoaded
            data={loaded as BroadcastDetailLoaderData}
          />
        )}
      </Await>
    </Suspense>
  );
}

function BroadcastDetailRouteLoaded({
  data,
}: {
  data: BroadcastDetailLoaderData;
}) {
  const {
    campaign,
    recipients,
    profileMap,
    recipientTotal,
    failureByCode,
    deliverySplit,
    retrySum,
    page,
    take,
  } = data;
  const [searchParams, setSearchParams] = useSearchParams();
  const [copiedRecipientId, setCopiedRecipientId] = useState<string | null>(
    null
  );
  const revalidator = useRevalidator();

  useEffect(() => {
    if (
      campaign.status === "QUEUED" ||
      campaign.status === "SENDING" ||
      campaign.status === "SCHEDULED"
    ) {
      const t = setInterval(() => {
        revalidator.revalidate();
      }, 5000);
      return () => clearInterval(t);
    }
    return;
  }, [campaign.status, revalidator]);

  useEffect(() => {
    if (!copiedRecipientId) return;
    const timer = window.setTimeout(() => setCopiedRecipientId(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copiedRecipientId]);

  const total = campaign.totalRecipients || 1;
  const done = campaign.sentCount + campaign.failedCount;
  const progressPct = Math.min(100, Math.round((done / total) * 100));
  const successPct =
    campaign.totalRecipients > 0
      ? Math.round((campaign.sentCount / campaign.totalRecipients) * 100)
      : 0;
  const durationMs =
    campaign.startedAt && campaign.completedAt
      ? new Date(campaign.completedAt).getTime() -
        new Date(campaign.startedAt).getTime()
      : null;

  const totalPages = Math.max(1, Math.ceil(recipientTotal / take));

  return (
    <div className="w-full min-w-0 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/dashboard/broadcasts"
            className="text-text-secondary text-sm hover:underline"
          >
            ← All broadcasts
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {campaign.name}
            </h1>
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                badgeClass(broadcastStatusBadgeKind(campaign.status))
              )}
            >
              {formatBroadcastCampaignStatus(campaign.status)}
            </span>
          </div>
          <p className="text-text-secondary mt-1 text-sm">
            {formatBroadcastAudienceLabel(
              campaign.audienceType,
              campaign.totalRecipients
            )}{" "}
            · {formatBroadcastDeliveryMode(campaign.deliveryMode)}
          </p>
          <p className="text-text-secondary mt-1 text-xs">
            Created {new Date(campaign.createdAt).toLocaleString()}
            {campaign.scheduledFor
              ? ` · Scheduled ${new Date(campaign.scheduledFor).toLocaleString()}`
              : null}
            {campaign.startedAt
              ? ` · Started ${new Date(campaign.startedAt).toLocaleString()}`
              : null}
            {campaign.completedAt
              ? ` · Completed ${new Date(campaign.completedAt).toLocaleString()}`
              : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Form method="post">
            <input type="hidden" name="intent" value="duplicate" />
            <button
              type="submit"
              className="border-border bg-canvas hover:bg-surface-hover rounded-md border px-3 py-2 text-sm font-medium"
            >
              Duplicate
            </button>
          </Form>
          {campaign.failedCount > 0 &&
          (campaign.status === "COMPLETED" ||
            campaign.status === "COMPLETED_WITH_FAILURES") ? (
            <Form method="post">
              <input type="hidden" name="intent" value="retry_failed" />
              <button
                type="submit"
                className="border-border bg-canvas hover:bg-surface-hover rounded-md border px-3 py-2 text-sm font-medium"
              >
                Retry failed
              </button>
            </Form>
          ) : null}
          {campaign.status === "SCHEDULED" ||
          campaign.status === "QUEUED" ||
          campaign.status === "SENDING" ? (
            <Form method="post">
              <input type="hidden" name="intent" value="cancel" />
              <button
                type="submit"
                className="border-warning/50 text-warning-text rounded-md border px-3 py-2 text-sm font-medium"
              >
                Cancel
              </button>
            </Form>
          ) : null}
          <Form method="post">
            <input type="hidden" name="intent" value="export_csv" />
            <button
              type="submit"
              className="bg-brand text-brand-on rounded-md px-3 py-2 text-sm font-medium"
            >
              Export CSV
            </button>
          </Form>
          <Form method="post">
            <input type="hidden" name="intent" value="export_json" />
            <button
              type="submit"
              className="border-border bg-canvas hover:bg-surface-hover rounded-md border px-3 py-2 text-sm font-medium"
            >
              Export JSON
            </button>
          </Form>
        </div>
      </div>

      <section className="border-border rounded-lg border p-4">
        <h2 className="font-medium">Progress</h2>
        <div className="bg-surface-hover mt-3 h-2 overflow-hidden rounded-full">
          <div
            className="bg-brand h-full transition-all"
            style={{ width: `${String(progressPct)}%` }}
          />
        </div>
        <p className="text-text-secondary mt-3 text-sm">
          {campaign.sentCount} / {campaign.totalRecipients} delivered ·{" "}
          {campaign.failedCount} failed · {campaign.suppressedCount} suppressed
          (pre-send)
          {campaign.status === "SENDING" || campaign.status === "QUEUED"
            ? " · updating every few seconds"
            : null}
        </p>
      </section>

      <section className="border-border rounded-lg border p-4">
        <h2 className="font-medium">Performance</h2>
        <ul className="text-text-secondary mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <li>Success rate (of attempts): {successPct}%</li>
          <li>Failures: {campaign.failedCount}</li>
          <li>
            Completion duration:{" "}
            {durationMs !== null
              ? `${String(Math.round(durationMs / 1000))}s`
              : "—"}
          </li>
          <li>Retry attempts (sum): {retrySum}</li>
          <li>
            Delivery split:{" "}
            {deliverySplit
              .map(
                (d) =>
                  `${d.deliveryMethodUsed ?? "UNKNOWN"}:${String(d._count._all)}`
              )
              .join(", ") || "—"}
          </li>
          <li>
            Top failure codes:{" "}
            {failureByCode
              .filter((f) => f.failureCode != null && f.failureCode !== "")
              .map((f) => `${String(f.failureCode)} (${String(f._count._all)})`)
              .join(", ") || "—"}
          </li>
        </ul>
      </section>

      <section className="border-border rounded-lg border p-4">
        <h2 className="font-medium">Message</h2>
        <p className="mt-2 text-sm whitespace-pre-wrap">
          {campaign.messageBody}
        </p>
      </section>

      <section className="border-border rounded-lg border p-4">
        <h2 className="mb-2 font-medium">Activity</h2>
        <ul className="divide-border max-h-72 divide-y overflow-y-auto text-sm">
          {campaign.eventLogs.map((log) => (
            <li key={log.id} className="flex gap-3 py-3">
              <div className="text-text-secondary w-36 shrink-0 text-xs whitespace-nowrap">
                {new Date(log.createdAt).toLocaleString()}
              </div>
              <div>
                <div className="font-medium">{log.eventType}</div>
                <div className="text-text-secondary">{log.message}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-border rounded-lg border p-4">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-medium">Recipients</h2>
          <Form
            method="get"
            className="flex flex-wrap items-center gap-2"
            onChange={(e) => {
              const form = (e.target as HTMLElement).closest("form");
              if (form) form.requestSubmit();
            }}
          >
            <select
              name="rstatus"
              defaultValue={data.statusFilter}
              className="border-border bg-canvas rounded-md border px-2 py-1 text-sm"
            >
              <option value="ALL">All</option>
              <option value="SENT">Sent</option>
              <option value="SENDING">Sending</option>
              <option value="QUEUED">Queued</option>
              <option value="FAILED">Failed</option>
              <option value="SUPPRESSED">Suppressed</option>
              <option value="PENDING">Pending</option>
            </select>
            <input
              type="search"
              name="rq"
              placeholder="Search pubkey…"
              defaultValue={data.search}
              className="border-border bg-canvas min-w-[160px] rounded-md border px-2 py-1 text-sm"
            />
            <button
              type="submit"
              className="text-brand text-sm font-medium hover:underline"
            >
              Apply
            </button>
          </Form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-surface-hover/50 border-b font-medium">
              <tr>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Recipient</th>
                <th className="px-2 py-2">Delivery</th>
                <th className="px-2 py-2">Retries</th>
                <th className="px-2 py-2">Sent at</th>
                <th className="px-2 py-2">Error</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recipients.map((r) => (
                <tr key={r.id} className="hover:bg-surface-hover/20">
                  <td className="px-2 py-2 font-mono">{r.status}</td>
                  <td className="px-2 py-2" title={r.recipientPubkey}>
                    {(() => {
                      const p = profileMap[r.recipientPubkey.toLowerCase()];
                      const label =
                        p?.name ?? formatNpubShort(r.recipientPubkey);
                      return (
                        <div className="cluster">
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
                  <td className="text-text-secondary px-2 py-2">
                    {r.deliveryMethodUsed ?? "—"}
                  </td>
                  <td className="px-2 py-2 tabular-nums">{r.attemptCount}</td>
                  <td className="text-text-secondary px-2 py-2 whitespace-nowrap">
                    {r.sentAt ? new Date(r.sentAt).toLocaleString() : "—"}
                  </td>
                  <td className="text-danger max-w-[200px] truncate px-2 py-2">
                    {r.failureReason ?? r.skipReason ?? "—"}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="text-brand hover:underline"
                        onClick={() => {
                          void navigator.clipboard.writeText(r.recipientPubkey);
                          setCopiedRecipientId(r.id);
                        }}
                      >
                        {copiedRecipientId === r.id ? "Copied" : "Copy"}
                      </button>
                      {r.status === "FAILED" ? (
                        <Form method="post" className="inline">
                          <input type="hidden" name="intent" value="suppress" />
                          <input
                            type="hidden"
                            name="pubkey"
                            value={r.recipientPubkey}
                          />
                          <button
                            type="submit"
                            className="text-text-secondary hover:underline"
                          >
                            Suppress
                          </button>
                        </Form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-text-secondary mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span>
            Page {page} / {totalPages} · {recipientTotal} matching
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              className="hover:text-text disabled:opacity-40"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.set("page", String(page - 1));
                setSearchParams(next);
              }}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              className="hover:text-text disabled:opacity-40"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.set("page", String(page + 1));
                setSearchParams(next);
              }}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
