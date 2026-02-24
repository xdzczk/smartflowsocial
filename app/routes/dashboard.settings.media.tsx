import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation } from "@remix-run/react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { requireUserId } from "~/features/auth";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import {
  deleteMediaById,
  findMediaByIdForUser,
  getMediaAggregateForUser,
  listMediaForUser,
} from "~/features/upload";
import { withCSRFProtection } from "~/lib/csrf";

const PAGE_SIZE = 50;

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "settings");

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));

  const [items, agg] = await Promise.all([
    listMediaForUser(userId, {
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    getMediaAggregateForUser(userId),
  ]);

  const totalCount = agg._count.id;
  const totalSize = agg._sum.size ?? 0;

  return json({
    items,
    totalCount,
    totalSize,
    page,
    totalPages: Math.ceil(totalCount / PAGE_SIZE),
  });
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    const userId = await requireUserId(request);
    const formData = await request.formData();
    const actionType = formData.get("_action");

    if (actionType === "delete_media") {
      const mediaId = formData.get("mediaId");
      if (typeof mediaId !== "string" || !mediaId) {
        return json({ error: "Missing media ID" }, { status: 400 });
      }
      const media = await findMediaByIdForUser(mediaId, userId);
      if (!media) {
        return json({ error: "Media not found" }, { status: 404 });
      }
      await deleteMediaById(mediaId);
      return redirect("/dashboard/settings/media");
    }

    return json({ error: "Unknown action" }, { status: 400 });
  }
);

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i] ?? "B"}`;
}

export default function SettingsMediaPage() {
  const { items, totalCount, totalSize, page, totalPages } =
    useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isDeleting =
    navigation.state === "submitting" &&
    navigation.formData?.get("_action") === "delete_media";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Media</h1>
          <p className="text-muted-foreground text-sm">
            Blossom media metadata (SmartFlow Blossom uploads). Delete here
            removes the record; the file may still exist on the Blossom server.
          </p>
        </div>
        <Link
          to="/dashboard/settings?tab=storage"
          className="text-primary text-sm hover:underline"
        >
          Back to Settings
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
          <CardDescription>
            Total files and size for your Blossom media
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex gap-6">
            <div>
              <dt className="text-muted-foreground text-sm">Files</dt>
              <dd className="text-xl font-semibold">{totalCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">Total size</dt>
              <dd className="text-xl font-semibold">
                {formatBytes(totalSize)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Media list</CardTitle>
          <CardDescription>
            Recent uploads (BLOSSOM_SFS). Delete removes the record only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No media recorded yet. Upload with SmartFlow Blossom to see items
              here.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 pr-4 text-left">URL</th>
                      <th className="py-2 pr-4 text-left">Size</th>
                      <th className="py-2 pr-4 text-left">Date</th>
                      <th className="py-2 pr-4 text-left">Provider</th>
                      <th className="w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((m) => (
                      <tr key={m.id} className="border-border/50 border-b">
                        <td className="py-2 pr-4">
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary block max-w-[200px] truncate hover:underline"
                          >
                            {m.url}
                          </a>
                        </td>
                        <td className="py-2 pr-4">
                          {m.size != null ? formatBytes(m.size) : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          {new Date(m.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2 pr-4">{m.provider}</td>
                        <td className="py-2">
                          <Form method="post">
                            <input
                              type="hidden"
                              name="_action"
                              value="delete_media"
                            />
                            <input type="hidden" name="mediaId" value={m.id} />
                            <button
                              type="submit"
                              disabled={isDeleting}
                              className="text-destructive text-xs hover:underline disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </Form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 ? (
                <div className="flex items-center justify-between pt-4">
                  <Link
                    to={`/dashboard/settings/media?page=${page - 1}`}
                    className={
                      page <= 1
                        ? "text-muted-foreground pointer-events-none"
                        : "text-primary hover:underline"
                    }
                  >
                    Previous
                  </Link>
                  <span className="text-muted-foreground text-sm">
                    Page {page} of {totalPages}
                  </span>
                  <Link
                    to={`/dashboard/settings/media?page=${page + 1}`}
                    className={
                      page >= totalPages
                        ? "text-muted-foreground pointer-events-none"
                        : "text-primary hover:underline"
                    }
                  >
                    Next
                  </Link>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
