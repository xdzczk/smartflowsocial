import { defer, json, type LoaderFunctionArgs } from "@remix-run/node";
import {
  Await,
  Form,
  Link,
  useLoaderData,
  useSearchParams,
} from "@remix-run/react";
import { Suspense, useMemo, useState } from "react";

import { DeferredRouteAwaitError } from "~/components/deferred-route/DeferredRouteAwaitError";
import { ADMIN_PAGE_BODY_CLASS } from "~/components/layout/page-layout-constants";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  AdminAccessDenied,
  AdminDataTable,
  AdminDataTableEmpty,
  AdminDataTableHead,
  AdminPageHeader,
  AdminSection,
  AdminUsersPageSkeleton,
} from "~/features/admin";
import type { AdminUserSegment } from "~/features/admin/repositories/admin-users-queries.server";
import { getAdminUsersPageData } from "~/features/admin/repositories/admin-users-queries.server";
import { requireUser } from "~/features/auth";
import { isReferralAdmin } from "~/features/referral/referral-admin.server";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { isRemixResourceRequest } from "~/lib/remix/is-remix-resource-request";
import { cn } from "~/lib/utils";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (!isReferralAdmin(user.npub)) {
    return json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const page = url.searchParams.get("page");
  const filter = url.searchParams.get("filter") ?? undefined;
  const sort = url.searchParams.get("sort") ?? undefined;
  const search = url.searchParams.get("q") ?? undefined;
  const usersPagePromise = getAdminUsersPageData({
    page: page ? parseInt(page, 10) : 1,
    filter,
    sort,
    search,
  });
  if (isRemixResourceRequest(request)) {
    return json(await usersPagePromise);
  }
  return defer({ usersPage: usersPagePromise });
}

const SEGMENTS: Array<{ id: AdminUserSegment | "all"; label: string }> = [
  { id: "all", label: "All segments" },
  { id: "new", label: "New" },
  { id: "activating", label: "Activating" },
  { id: "established", label: "Established" },
  { id: "power", label: "Power" },
  { id: "at_risk", label: "At risk" },
  { id: "dormant", label: "Dormant" },
];

function segmentBadgeClass(s: AdminUserSegment): string {
  switch (s) {
    case "power":
      return "border-success/40 bg-success/10 text-success-text";
    case "at_risk":
      return "border-warning/50 bg-warning/10 text-warning-text";
    case "dormant":
      return "border-border bg-surface-hover text-text-secondary";
    case "new":
      return "border-info/40 bg-info/10 text-info-text dark:text-info";
    case "activating":
      return "border-selection-border/40 bg-selection-wash text-selection-foreground";
    default:
      return "border-border bg-surface";
  }
}

type AdminUsersLoaderData =
  | { error: string }
  | { usersPage: Promise<Awaited<ReturnType<typeof getAdminUsersPageData>>> };

export default function AdminUsersPage() {
  const raw = useLoaderData<AdminUsersLoaderData>();
  if ("error" in raw) {
    return <AdminAccessDenied />;
  }

  return (
    <Suspense fallback={<AdminUsersPageSkeleton />}>
      <Await
        resolve={raw.usersPage}
        errorElement={
          <DeferredRouteAwaitError retryTo="/dashboard/admin/users" />
        }
      >
        {(loaded) => (
          <AdminUsersPageLoaded
            data={loaded as Awaited<ReturnType<typeof getAdminUsersPageData>>}
          />
        )}
      </Await>
    </Suspense>
  );
}

function AdminUsersPageLoaded({
  data: d,
}: {
  data: Awaited<ReturnType<typeof getAdminUsersPageData>>;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sheetUserId, setSheetUserId] = useState<string | null>(null);
  const { formatDate } = useFormattedDate();

  const formatDateTime = (iso: string | null | undefined) =>
    iso
      ? formatDate(iso, {
          dateFormatOptions: {
            dateStyle: "medium",
            timeStyle: "short",
          },
        })
      : "—";

  const segmentFilter =
    (searchParams.get("segment") as AdminUserSegment | "all" | null) ?? "all";

  const visibleUsers = useMemo(() => {
    if (segmentFilter === "all") return d.users;
    return d.users.filter((u) => u.segment === segmentFilter);
  }, [d, segmentFilter]);

  const sheetUser = d.users.find((u) => u.id === sheetUserId) ?? null;

  const totalPages = Math.ceil(d.total / d.pageSize);

  function avatarFallbackLabel(displayName: string | null, npub: string) {
    const n = displayName?.trim();
    if (n) {
      const parts = n.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
      }
      return n.slice(0, 2).toUpperCase();
    }
    return npub.slice(5, 7).toUpperCase();
  }

  function setFilter(next: string) {
    const p = new URLSearchParams(searchParams);
    p.set("filter", next);
    p.delete("page");
    setSearchParams(p);
  }

  function setSegment(next: string) {
    const p = new URLSearchParams(searchParams);
    if (next === "all") {
      p.delete("segment");
    } else {
      p.set("segment", next);
    }
    setSearchParams(p);
  }

  function setSort(next: string) {
    const p = new URLSearchParams(searchParams);
    p.set("sort", next);
    p.delete("page");
    setSearchParams(p);
  }

  return (
    <div>
      <AdminPageHeader
        title="Users"
        subtitle="Directory with lifecycle heuristics and 7d activity. Segment filters apply to the current page of results."
      />
      <div className={`${ADMIN_PAGE_BODY_CLASS} space-y-6`}>
        <div className="flex flex-wrap gap-2">
          {["all", "enabled", "disabled", "paid", "referred"].map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={d.filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-text-secondary text-xs">Segment</span>
          {SEGMENTS.map((s) => (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant={segmentFilter === s.id ? "default" : "outline"}
              className="text-xs"
              onClick={() => setSegment(s.id)}
            >
              {s.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-text-secondary self-center text-xs">Sort</span>
          {[
            { id: "createdAt", label: "Signup" },
            { id: "lastActive", label: "Last active" },
            { id: "published", label: "Published" },
          ].map((s) => (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant={d.sort === s.id ? "default" : "outline"}
              onClick={() => setSort(s.id)}
            >
              {s.label}
            </Button>
          ))}
        </div>

        <Form method="get" className="flex flex-wrap gap-2">
          <input type="hidden" name="filter" value={d.filter} />
          <input type="hidden" name="sort" value={d.sort} />
          {segmentFilter !== "all" ? (
            <input type="hidden" name="segment" value={segmentFilter} />
          ) : null}
          <input
            name="q"
            defaultValue={d.search}
            placeholder="Search npub or id"
            className="border-border min-w-[200px] flex-1 rounded-md border px-2 py-1 text-sm"
          />
          <Button type="submit" size="sm">
            Search
          </Button>
        </Form>

        <AdminSection eyebrow="Directory" title="Accounts">
          <AdminDataTable zebra>
            <AdminDataTableHead>
              <tr>
                <th className="p-2 text-left">User</th>
                <th className="p-2 text-left">Segment</th>
                <th className="p-2 text-left">Plan</th>
                <th className="p-2 text-center">Enabled</th>
                <th className="p-2 text-right">Last active</th>
                <th className="p-2 text-right">7d pub</th>
                <th className="p-2 text-right">Published</th>
                <th className="p-2 text-right">Scheduled</th>
                <th className="p-2 text-right">Media</th>
                <th className="p-2 text-right">Refs</th>
                <th className="p-2 text-left">Signer</th>
                <th className="p-2 text-right">Sess 30d</th>
                <th className="p-2 text-right">Reconn fail</th>
              </tr>
            </AdminDataTableHead>
            <tbody>
              {visibleUsers.length === 0 ? (
                <AdminDataTableEmpty colSpan={13}>
                  No users match this view.
                </AdminDataTableEmpty>
              ) : (
                visibleUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-surface-hover/30 cursor-pointer"
                    onClick={() => setSheetUserId(u.id)}
                  >
                    <td className="p-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar className="h-9 w-9 shrink-0">
                          {u.pictureUrl ? (
                            <AvatarImage
                              src={u.pictureUrl}
                              alt=""
                              loading="lazy"
                            />
                          ) : null}
                          <AvatarFallback className="text-xs">
                            {avatarFallbackLabel(u.displayName, u.npub)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium">
                            {u.displayName ?? "—"}{" "}
                            <span className="text-text-secondary text-xs font-normal">
                              {u.isEnabled ? "" : "(disabled)"}
                            </span>
                          </p>
                          <p className="text-text-secondary font-mono text-[10px] break-all">
                            {u.npub}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-2">
                      <Badge
                        className={cn(
                          "font-normal capitalize",
                          segmentBadgeClass(u.segment)
                        )}
                        variant="outline"
                      >
                        {u.segment.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="p-2">{u.planLabel}</td>
                    <td className="p-2 text-center">
                      {u.isEnabled ? "Yes" : "No"}
                    </td>
                    <td className="text-text-secondary p-2 text-right text-xs tabular-nums">
                      {formatDateTime(u.lastActivityAt)}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {u.recent7dPublishes}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {u.publishedPosts}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {u.scheduledPosts}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {u.mediaCount}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {u.referralCount}
                      {u.referralAttributed ? (
                        <span className="text-text-secondary ml-1 text-[10px]">
                          (in)
                        </span>
                      ) : null}
                    </td>
                    <td className="text-text-secondary p-2 text-xs">
                      {u.signerModality === "nip46"
                        ? "Remote (NIP-46)"
                        : "Ext / unset"}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {u.sessionsIn30d}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {u.reconnectFailures30d > 0 ? (
                        <span className="text-warning-text">
                          {u.reconnectFailures30d}
                        </span>
                      ) : (
                        "0"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </AdminDataTable>
        </AdminSection>

        <Sheet
          open={sheetUserId !== null}
          onOpenChange={(open) => {
            if (!open) setSheetUserId(null);
          }}
        >
          <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
            {sheetUser ? (
              <>
                <SheetHeader>
                  <div className="flex items-start gap-3">
                    <Avatar className="h-14 w-14 shrink-0">
                      {sheetUser.pictureUrl ? (
                        <AvatarImage
                          src={sheetUser.pictureUrl}
                          alt=""
                          loading="lazy"
                        />
                      ) : null}
                      <AvatarFallback>
                        {avatarFallbackLabel(
                          sheetUser.displayName,
                          sheetUser.npub
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <SheetTitle className="text-left">
                        {sheetUser.displayName ?? "—"}
                      </SheetTitle>
                      <SheetDescription className="font-mono text-xs break-all">
                        {sheetUser.npub}
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>
                <div className="mt-6 space-y-4 text-sm">
                  <div>
                    <p className="text-text-secondary text-xs font-medium uppercase">
                      Segment
                    </p>
                    <Badge
                      className={cn(
                        "mt-1 capitalize",
                        segmentBadgeClass(sheetUser.segment)
                      )}
                      variant="outline"
                    >
                      {sheetUser.segment.replace("_", " ")}
                    </Badge>
                    <p className="text-text-secondary mt-2 text-xs">
                      Heuristic only - based on recency, volume, and plan.
                    </p>
                  </div>
                  <dl className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <dt className="text-text-secondary text-xs">User id</dt>
                      <dd className="font-mono text-xs break-all">
                        {sheetUser.id}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary text-xs">Signup</dt>
                      <dd className="tabular-nums">
                        {formatDateTime(sheetUser.createdAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary text-xs">
                        Last activity
                      </dt>
                      <dd className="tabular-nums">
                        {formatDateTime(sheetUser.lastActivityAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary text-xs">
                        First publish
                      </dt>
                      <dd className="tabular-nums">
                        {formatDateTime(sheetUser.firstPublishedAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary text-xs">
                        Subscription started
                      </dt>
                      <dd className="tabular-nums">
                        {formatDateTime(sheetUser.subscriptionStartedAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary text-xs">
                        7d publishes
                      </dt>
                      <dd>{sheetUser.recent7dPublishes}</dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary text-xs">
                        Signer modality
                      </dt>
                      <dd>
                        {sheetUser.signerModality === "nip46"
                          ? "NIP-46 profile saved"
                          : "Extension or unset"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary text-xs">
                        Product sessions (30d)
                      </dt>
                      <dd>{sheetUser.sessionsIn30d}</dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary text-xs">
                        Reconnect failures (30d)
                      </dt>
                      <dd>{sheetUser.reconnectFailures30d}</dd>
                    </div>
                  </dl>
                  <div>
                    <p className="text-text-secondary text-xs font-medium uppercase">
                      Output
                    </p>
                    <ul className="mt-1 space-y-1">
                      <li>
                        Published: {sheetUser.publishedPosts} · Scheduled:{" "}
                        {sheetUser.scheduledPosts} · Media:{" "}
                        {sheetUser.mediaCount}
                      </li>
                      <li>
                        Referrals as referrer: {sheetUser.referralCount}
                        {sheetUser.referralAttributed
                          ? " · arrived via referral"
                          : ""}
                      </li>
                    </ul>
                  </div>
                </div>
              </>
            ) : null}
          </SheetContent>
        </Sheet>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-text-secondary">
            Page {d.page} / {totalPages || 1} · {d.total} users
          </span>
          {d.page > 1 ? (
            <Link
              className="text-link hover:text-link-hover hover:underline"
              to={`?${new URLSearchParams({
                ...Object.fromEntries(searchParams),
                page: String(d.page - 1),
              }).toString()}`}
            >
              Previous
            </Link>
          ) : null}
          {d.page < totalPages ? (
            <Link
              className="text-link hover:text-link-hover hover:underline"
              to={`?${new URLSearchParams({
                ...Object.fromEntries(searchParams),
                page: String(d.page + 1),
              }).toString()}`}
            >
              Next
            </Link>
          ) : null}
        </div>

        <Link
          to="/dashboard/admin"
          className="text-link hover:text-link-hover text-sm hover:underline"
        >
          ← Overview
        </Link>
      </div>
    </div>
  );
}
