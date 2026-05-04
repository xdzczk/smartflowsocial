import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { defer, json, redirect } from "@remix-run/node";
import {
  Await,
  Form,
  Link,
  useLoaderData,
  useSearchParams,
} from "@remix-run/react";
import { Megaphone } from "lucide-react";
import { Suspense } from "react";

import { BroadcastCampaignRowActions } from "~/components/broadcast/BroadcastCampaignRowActions";
import { BroadcastIndexPageSkeleton } from "~/components/broadcast/BroadcastIndexPageSkeleton";
import { DeferredRouteAwaitError } from "~/components/deferred-route/DeferredRouteAwaitError";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
import { requireUserId } from "~/features/auth";
import {
  archiveBroadcastCampaign,
  type BroadcastIndexFilters,
  broadcastStatusBadgeKind,
  cancelBroadcastCampaign,
  deleteBroadcastDraft,
  duplicateBroadcastCampaign,
  retryBroadcastFailedRecipients,
  formatBroadcastAudienceLabel,
  formatBroadcastCampaignStatus,
  formatBroadcastDeliveryMode,
  getBroadcastDashboardSummary,
  listBroadcastCampaignsForIndex,
  unarchiveBroadcastCampaign,
} from "~/features/broadcast";
import {
  campaignFieldClassNames,
  campaignSelectClassNames,
} from "~/features/campaign-ui";
import { requireAnySubscription } from "~/features/payments";
import { PublishingPageHeader } from "~/features/posts/ui";
import {
  DeferredRouteLoaderProvider,
  useDeferredRouteLoaderData,
} from "~/lib/remix/deferred-route-loader-context";
import { isRemixResourceRequest } from "~/lib/remix/is-remix-resource-request";
import { cn } from "~/lib/utils";

const BROADCAST_FILTER_NARROW_FIELD_CLASS = "w-auto min-w-[9rem]";

function parseIndexFilters(url: URL): BroadcastIndexFilters {
  const q = url.searchParams.get("q")?.trim();
  const statusRaw = url.searchParams.get("status")?.trim();
  const audienceType = url.searchParams.get("audience")?.trim();
  const deliveryMode = url.searchParams.get("delivery")?.trim();
  const dateFrom = url.searchParams.get("from");
  const dateTo = url.searchParams.get("to");
  const includeArchived = url.searchParams.get("archived") === "1";
  const bucket = url.searchParams.get("bucket");

  const filters: BroadcastIndexFilters = { includeArchived };
  if (q) filters.search = q;
  if (bucket === "drafts") filters.draftsBucket = true;

  if (statusRaw === "IN_FLIGHT" || statusRaw === "NEEDS_ATTENTION") {
    filters.status = statusRaw;
  } else if (
    statusRaw &&
    [
      "DRAFT",
      "AWAITING_SIGNATURE",
      "SCHEDULED",
      "QUEUED",
      "SENDING",
      "COMPLETED",
      "COMPLETED_WITH_FAILURES",
      "PAUSED",
      "FAILED",
      "CANCELLED",
    ].includes(statusRaw)
  ) {
    filters.status = statusRaw as BroadcastIndexFilters["status"];
  }

  if (
    audienceType &&
    ["CUSTOM", "FOLLOWERS", "MUTUALS"].includes(audienceType)
  ) {
    filters.audienceType = audienceType as NonNullable<
      BroadcastIndexFilters["audienceType"]
    >;
  }

  if (
    deliveryMode &&
    [
      "BEST_COMPATIBILITY",
      "NIP17_ONLY",
      "NIP04_ONLY",
      "NIP17_FALLBACK_NIP04",
      "BOTH",
    ].includes(deliveryMode)
  ) {
    filters.deliveryMode = deliveryMode as NonNullable<
      BroadcastIndexFilters["deliveryMode"]
    >;
  }

  if (dateFrom) {
    const d = new Date(dateFrom);
    if (!Number.isNaN(d.getTime())) filters.dateFrom = d;
  }
  if (dateTo) {
    const d = new Date(dateTo);
    if (!Number.isNaN(d.getTime())) filters.dateTo = d;
  }

  return filters;
}

const BROADCASTS_INDEX_HREF = "/dashboard/broadcasts";

async function loadBroadcastsIndexData(request: Request) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);

  const url = new URL(request.url);
  const filters = parseIndexFilters(url);
  const [summary, campaigns] = await Promise.all([
    getBroadcastDashboardSummary(userId),
    listBroadcastCampaignsForIndex(userId, filters),
  ]);

  return { summary, campaigns, filters };
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (isRemixResourceRequest(request)) {
    return json(await loadBroadcastsIndexData(request));
  }
  return defer({
    broadcastsIndex: loadBroadcastsIndexData(request),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);

  const form = await request.formData();
  const intent = form.get("intent");
  const campaignId = form.get("campaignId");
  if (typeof campaignId !== "string" || !campaignId) {
    return json({ error: "Missing campaign" }, { status: 400 });
  }

  if (intent === "cancel") {
    await cancelBroadcastCampaign(userId, campaignId);
    return redirect(BROADCASTS_INDEX_HREF);
  }
  if (intent === "delete") {
    await deleteBroadcastDraft(userId, campaignId);
    return redirect(BROADCASTS_INDEX_HREF);
  }
  if (intent === "archive") {
    await archiveBroadcastCampaign(userId, campaignId);
    return redirect(BROADCASTS_INDEX_HREF);
  }
  if (intent === "unarchive") {
    await unarchiveBroadcastCampaign(userId, campaignId);
    return redirect(`${BROADCASTS_INDEX_HREF}?archived=1`);
  }
  if (intent === "duplicate") {
    const { id } = await duplicateBroadcastCampaign(userId, campaignId);
    return redirect(
      `/dashboard/broadcasts/new?campaignId=${encodeURIComponent(id)}`
    );
  }
  if (intent === "retry_failed") {
    const { id } = await retryBroadcastFailedRecipients(userId, campaignId);
    return redirect(
      `/dashboard/broadcasts/new/review?campaignId=${encodeURIComponent(id)}`
    );
  }
  return json({ error: "Unknown intent" }, { status: 400 });
}

function SummaryCard(props: {
  label: string;
  value: number;
  href: string;
  active?: boolean;
}) {
  return (
    <Link
      to={props.href}
      className={cn(
        "border-border bg-surface shadow-1 hover:bg-surface-hover/40 motion-fast rounded-xl border p-4",
        props.active &&
          "ring-selection-border/50 ring-offset-canvas ring-2 ring-offset-2"
      )}
    >
      <div className="text-text-secondary text-xs font-medium tracking-wide uppercase">
        {props.label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        {props.value}
      </div>
    </Link>
  );
}

function broadcastsIndexHrefQuery(params: Record<string, string>): string {
  const q = new URLSearchParams(params).toString();
  return q ? `${BROADCASTS_INDEX_HREF}?${q}` : BROADCASTS_INDEX_HREF;
}

function statusBadgeClass(kind: string): string {
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
      return "bg-selection-wash text-selection-foreground";
    default:
      return "bg-surface-hover text-text-secondary";
  }
}

type BroadcastsIndexPayload = Awaited<
  ReturnType<typeof loadBroadcastsIndexData>
>;

function BroadcastsIndexPage() {
  const data = useDeferredRouteLoaderData() as BroadcastsIndexPayload;
  const { summary, campaigns, filters } = data;
  const [searchParams] = useSearchParams();
  const activeBucket = searchParams.get("bucket");

  const sentPct = (c: (typeof campaigns)[0]) =>
    c.totalRecipients > 0
      ? Math.round((c.sentCount / c.totalRecipients) * 100)
      : 0;
  const failedPct = (c: (typeof campaigns)[0]) =>
    c.totalRecipients > 0
      ? Math.round((c.failedCount / c.totalRecipients) * 100)
      : 0;

  return (
    <div className="w-full min-w-0 space-y-8">
      <PublishingPageHeader
        title="Broadcasts"
        subtitle="Send signed Nostr direct messages to selected audiences with compatibility-aware delivery."
        actions={
          <Button asChild>
            <Link to="/dashboard/broadcasts/new">New broadcast</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          label="Drafts"
          value={summary.drafts}
          href={broadcastsIndexHrefQuery({ bucket: "drafts" })}
          active={activeBucket === "drafts"}
        />
        <SummaryCard
          label="Scheduled"
          value={summary.scheduled}
          href={broadcastsIndexHrefQuery({
            status: "SCHEDULED",
            bucket: "scheduled",
          })}
          active={activeBucket === "scheduled"}
        />
        <SummaryCard
          label="In progress"
          value={summary.inProgress}
          href={broadcastsIndexHrefQuery({
            status: "IN_FLIGHT",
            bucket: "in_progress",
          })}
          active={activeBucket === "in_progress"}
        />
        <SummaryCard
          label="Completed"
          value={summary.completed}
          href={broadcastsIndexHrefQuery({
            status: "COMPLETED",
            bucket: "completed",
          })}
          active={activeBucket === "completed"}
        />
        <SummaryCard
          label="Attention"
          value={summary.attention}
          href={broadcastsIndexHrefQuery({
            status: "NEEDS_ATTENTION",
            bucket: "attention",
          })}
          active={activeBucket === "attention"}
        />
      </div>

      <Form method="get" className="space-y-3">
        {filters.includeArchived ? (
          <input type="hidden" name="archived" value="1" />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Input
            type="search"
            name="q"
            defaultValue={filters.search ?? ""}
            placeholder="Search name or message…"
            className="bg-surface min-w-[200px] flex-1"
          />
          <select
            name="status"
            defaultValue={
              typeof filters.status === "string" ? filters.status : ""
            }
            className={cn(campaignSelectClassNames, "w-auto min-w-[10rem]")}
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="AWAITING_SIGNATURE">Awaiting signature</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="IN_FLIGHT">
              In progress (awaiting sign / queued / sending)
            </option>
            <option value="QUEUED">Queued</option>
            <option value="SENDING">Sending</option>
            <option value="COMPLETED">Completed</option>
            <option value="COMPLETED_WITH_FAILURES">
              Completed with failures
            </option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="NEEDS_ATTENTION">Needs attention</option>
          </select>
          <select
            name="audience"
            defaultValue={filters.audienceType ?? ""}
            className={cn(
              campaignSelectClassNames,
              BROADCAST_FILTER_NARROW_FIELD_CLASS
            )}
          >
            <option value="">All audiences</option>
            <option value="CUSTOM">Custom list</option>
            <option value="FOLLOWERS">Followers</option>
            <option value="MUTUALS">Mutuals</option>
          </select>
          <select
            name="delivery"
            defaultValue={filters.deliveryMode ?? ""}
            className={cn(campaignSelectClassNames, "w-auto min-w-[11rem]")}
          >
            <option value="">All delivery modes</option>
            <option value="BEST_COMPATIBILITY">Best compatibility</option>
            <option value="NIP17_ONLY">NIP-17 only</option>
            <option value="NIP04_ONLY">NIP-04 only</option>
            <option value="NIP17_FALLBACK_NIP04">NIP-17 + fallback</option>
            <option value="BOTH">Both</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-text-secondary cluster text-sm">
            <span>Updated from</span>
            <input
              type="date"
              name="from"
              defaultValue={
                filters.dateFrom
                  ? filters.dateFrom.toISOString().slice(0, 10)
                  : ""
              }
              className={cn(
                campaignFieldClassNames,
                BROADCAST_FILTER_NARROW_FIELD_CLASS
              )}
            />
          </label>
          <label className="text-text-secondary cluster text-sm">
            <span>to</span>
            <input
              type="date"
              name="to"
              defaultValue={
                filters.dateTo ? filters.dateTo.toISOString().slice(0, 10) : ""
              }
              className={cn(
                campaignFieldClassNames,
                BROADCAST_FILTER_NARROW_FIELD_CLASS
              )}
            />
          </label>
          <Button type="submit" size="sm">
            Apply filters
          </Button>
          <Link
            to={BROADCASTS_INDEX_HREF}
            className="text-text-secondary text-sm hover:underline"
          >
            Reset
          </Link>
          <Link
            to={
              filters.includeArchived
                ? BROADCASTS_INDEX_HREF
                : `${BROADCASTS_INDEX_HREF}?archived=1`
            }
            className="text-link hover:text-link-hover text-sm font-medium hover:underline"
          >
            {filters.includeArchived ? "Hide archived" : "Show archived"}
          </Link>
        </div>
      </Form>

      {campaigns.length === 0 ? (
        <EmptyState
          className="border-border bg-surface shadow-1 rounded-xl border"
          icon={<Megaphone />}
          title="No broadcasts match these filters"
          description="Create a campaign to reach your audience with signed direct messages - use meaningful updates, not noise."
          action={
            <Button asChild>
              <Link to="/dashboard/broadcasts/new">New broadcast</Link>
            </Button>
          }
        />
      ) : (
        <div className="border-border bg-surface shadow-1 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-surface-hover/50 border-b text-xs font-medium">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Audience</th>
                <th className="px-3 py-2 text-right">Recipients</th>
                <th className="px-3 py-2 text-right">Sent %</th>
                <th className="px-3 py-2 text-right">Failed %</th>
                <th className="px-3 py-2">Schedule / sent</th>
                <th className="px-3 py-2">Delivery</th>
                <th className="px-3 py-2">Updated</th>
                <th className="w-12 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-surface-hover/30">
                  <td className="px-3 py-2 font-medium">
                    <Link
                      to={`/dashboard/broadcasts/${c.id}`}
                      className="hover:underline"
                    >
                      {c.name}
                    </Link>
                    {c.archivedAt ? (
                      <span className="text-text-secondary ml-2 text-xs">
                        (archived)
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        statusBadgeClass(broadcastStatusBadgeKind(c.status))
                      )}
                    >
                      {formatBroadcastCampaignStatus(c.status)}
                    </span>
                  </td>
                  <td className="text-text-secondary px-3 py-2 text-xs">
                    {formatBroadcastAudienceLabel(
                      c.audienceType,
                      c.totalRecipients
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {c.totalRecipients}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {sentPct(c)}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {failedPct(c)}%
                  </td>
                  <td className="text-text-secondary px-3 py-2 text-xs whitespace-nowrap">
                    {c.scheduledFor
                      ? `Scheduled ${new Date(c.scheduledFor).toLocaleString()}`
                      : c.completedAt
                        ? `Done ${new Date(c.completedAt).toLocaleString()}`
                        : c.startedAt
                          ? `Started ${new Date(c.startedAt).toLocaleString()}`
                          : "—"}
                  </td>
                  <td className="text-text-secondary px-3 py-2 text-xs">
                    {formatBroadcastDeliveryMode(c.deliveryMode)}
                  </td>
                  <td className="text-text-secondary px-3 py-2 text-xs whitespace-nowrap">
                    {new Date(c.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-1 py-1">
                    <BroadcastCampaignRowActions
                      campaignId={c.id}
                      status={c.status}
                      isArchived={!!c.archivedAt}
                      totalRecipients={c.totalRecipients}
                      failedCount={c.failedCount}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface BroadcastsIndexDeferredLoaderData {
  broadcastsIndex: Promise<BroadcastsIndexPayload>;
}

export default function BroadcastsIndexRoute() {
  const { broadcastsIndex } =
    useLoaderData() as BroadcastsIndexDeferredLoaderData;

  return (
    <Suspense fallback={<BroadcastIndexPageSkeleton />}>
      <Await
        resolve={broadcastsIndex}
        errorElement={
          <DeferredRouteAwaitError retryTo="/dashboard/broadcasts" />
        }
      >
        {(loaded) => (
          <DeferredRouteLoaderProvider value={loaded}>
            <BroadcastsIndexPage />
          </DeferredRouteLoaderProvider>
        )}
      </Await>
    </Suspense>
  );
}
