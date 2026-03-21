import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { AdminPageHeader } from "~/features/admin";
import { getAdminUsersPageData } from "~/features/admin/repositories/admin-users-queries.server";
import { requireUser } from "~/features/auth";
import { isReferralAdmin } from "~/features/referral/referral-admin.server";

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
  const data = await getAdminUsersPageData({
    page: page ? parseInt(page, 10) : 1,
    filter,
    sort,
    search,
  });
  return json(data);
}

export default function AdminUsersPage() {
  const raw = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- narrow from loose loader type
  if (typeof raw === "object" && raw !== null && "error" in raw) {
    return <div className="p-4">Access denied.</div>;
  }
  const d = raw as Awaited<ReturnType<typeof getAdminUsersPageData>>;

  const selected = d.users.find((u) => u.id === selectedId) ?? null;
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

  return (
    <div>
      <AdminPageHeader
        title="Users"
        subtitle="Directory of accounts with usage signals. Segments are derived from data, not manual tags."
      />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
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

        <Form method="get" className="flex flex-wrap gap-2">
          <input type="hidden" name="filter" value={d.filter} />
          <input
            name="q"
            defaultValue={d.search}
            placeholder="Search npub or id"
            className="border-input min-w-[200px] flex-1 rounded-md border px-2 py-1 text-sm"
          />
          <Button type="submit" size="sm">
            Search
          </Button>
        </Form>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="p-2 text-left">User</th>
                <th className="p-2 text-left">Plan</th>
                <th className="p-2 text-center">Enabled</th>
                <th className="p-2 text-right">Published</th>
                <th className="p-2 text-right">Scheduled</th>
                <th className="p-2 text-right">Media</th>
                <th className="p-2 text-right">Referrals</th>
              </tr>
            </thead>
            <tbody>
              {d.users.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-muted/40 cursor-pointer border-b"
                  onClick={() =>
                    setSelectedId(selectedId === u.id ? null : u.id)
                  }
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
                          <span className="text-muted-foreground text-xs font-normal">
                            {u.isEnabled ? "" : "(disabled)"}
                          </span>
                        </p>
                        <p className="text-muted-foreground font-mono text-[10px] break-all">
                          {u.npub}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-2">{u.planLabel}</td>
                  <td className="p-2 text-center">
                    {u.isEnabled ? "Yes" : "No"}
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected ? (
          <div className="border-border bg-muted/20 rounded-lg border p-4 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar className="h-12 w-12 shrink-0">
                {selected.pictureUrl ? (
                  <AvatarImage
                    src={selected.pictureUrl}
                    alt=""
                    loading="lazy"
                  />
                ) : null}
                <AvatarFallback>
                  {avatarFallbackLabel(selected.displayName, selected.npub)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">{selected.displayName ?? "—"}</h3>
                <p className="text-muted-foreground font-mono text-xs break-all">
                  {selected.npub}
                </p>
              </div>
            </div>
            <h4 className="mt-4 font-medium">Details</h4>
            <dl className="mt-2 grid gap-1 sm:grid-cols-2">
              <dt className="text-muted-foreground">ID</dt>
              <dd className="font-mono text-xs">{selected.id}</dd>
              <dt className="text-muted-foreground">Signup</dt>
              <dd>{selected.createdAt}</dd>
              <dt className="text-muted-foreground">Published / scheduled</dt>
              <dd>
                {selected.publishedPosts} / {selected.scheduledPosts}
              </dd>
            </dl>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            Page {d.page} / {totalPages || 1} · {d.total} users
          </span>
          {d.page > 1 ? (
            <Link
              className="text-primary hover:underline"
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
              className="text-primary hover:underline"
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
          className="text-primary text-sm hover:underline"
        >
          ← Overview
        </Link>
      </div>
    </div>
  );
}
