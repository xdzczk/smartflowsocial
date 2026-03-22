import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import {
  createBroadcastSavedAudience,
  deleteBroadcastSavedAudience,
  formatBroadcastAudienceLabel,
  listBroadcastSavedAudiences,
} from "~/features/broadcast";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "broadcasts");

  const rows = await listBroadcastSavedAudiences(userId);
  return json({ rows });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "broadcasts");

  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "create") {
    const name = String(form.get("name") ?? "").trim();
    const audienceType = String(form.get("audienceType") ?? "CUSTOM");
    const customRaw = String(form.get("customNpubs") ?? "");
    const customNpubLines = customRaw
      .split(/[\r\n,]+/)
      .map((l) => l.trim())
      .filter(Boolean);
    const ruleSummary = String(form.get("ruleSummary") ?? "").trim();
    if (!name) {
      return json({ error: "Name required" }, { status: 400 });
    }
    if (
      !["CUSTOM", "FOLLOWING", "FOLLOWERS", "MUTUALS"].includes(audienceType)
    ) {
      return json({ error: "Invalid audience" }, { status: 400 });
    }
    await createBroadcastSavedAudience(userId, {
      name,
      audienceType: audienceType as
        | "CUSTOM"
        | "FOLLOWING"
        | "FOLLOWERS"
        | "MUTUALS",
      customNpubLines,
      ruleSummary: ruleSummary || undefined,
    });
    return redirect("/dashboard/broadcasts/audiences");
  }

  if (intent === "delete") {
    const id = String(form.get("id") ?? "");
    if (!id) return json({ error: "Missing id" }, { status: 400 });
    await deleteBroadcastSavedAudience(userId, id);
    return redirect("/dashboard/broadcasts/audiences");
  }

  return json({ error: "Unknown intent" }, { status: 400 });
}

export default function BroadcastAudiencesRoute() {
  const { rows } = useLoaderData<typeof loader>();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audiences</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Save audience definitions to reuse in new broadcasts. Graph-based
          types (followers, etc.) resolve at send time.
        </p>
      </div>

      <section className="border-border rounded-lg border p-4">
        <h2 className="font-medium">Save new audience</h2>
        <Form method="post" className="mt-4 space-y-3">
          <input type="hidden" name="intent" value="create" />
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
            >
              <option value="CUSTOM">Custom list</option>
              <option value="FOLLOWING">Following</option>
              <option value="FOLLOWERS">Followers</option>
              <option value="MUTUALS">Mutuals</option>
            </select>
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium"
              htmlFor="aud-custom"
            >
              Custom npubs / hex (optional for graph types)
            </label>
            <textarea
              id="aud-custom"
              name="customNpubs"
              rows={4}
              className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-sm"
            />
          </div>
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
                    <td className="text-muted-foreground px-3 py-2 text-xs">
                      {r.audienceType}
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
