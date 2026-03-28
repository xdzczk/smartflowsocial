import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { defer, json, redirect } from "@remix-run/node";
import {
  Await,
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { Suspense } from "react";

import { DeferredRouteAwaitError } from "~/components/deferred-route/DeferredRouteAwaitError";
import { DeferredListPageSkeleton } from "~/components/skeletons/DeferredListPageSkeleton";
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
  getSubscriptionData,
} from "~/features/payments";
import { getBlossomStorageLimitBytes } from "~/features/payments/blossom-storage-limits";
import {
  deleteMediaById,
  deleteRemoteBlossomObject,
  findMediaByIdForUser,
  getMediaAggregateForUser,
  listMediaForUser,
} from "~/features/upload";
import { withCSRFProtection } from "~/lib/csrf";
import {
  DeferredRouteLoaderProvider,
  useDeferredRouteLoaderData,
} from "~/lib/remix/deferred-route-loader-context";
import { isRemixResourceRequest } from "~/lib/remix/is-remix-resource-request";

const PAGE_SIZE = 50;
interface ActionData {
  error?: string;
}

async function loadSettingsMediaData({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "settings");

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));

  const SFS_PROVIDER = "BLOSSOM_SFS";
  const [items, agg, subscriptionData] = await Promise.all([
    listMediaForUser(userId, {
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      provider: SFS_PROVIDER,
    }),
    getMediaAggregateForUser(userId, { provider: SFS_PROVIDER }),
    getSubscriptionData(userId),
  ]);

  const totalCount = agg._count.id;
  const totalSize = agg._sum.size ?? 0;
  const storageLimitBytes = getBlossomStorageLimitBytes(
    subscriptionData.currentSubscription?.planId ?? null
  );

  return {
    items,
    totalCount,
    totalSize,
    storageLimitBytes: storageLimitBytes > 0 ? storageLimitBytes : null,
    page,
    totalPages: Math.ceil(totalCount / PAGE_SIZE),
  };
}

export async function loader(args: LoaderFunctionArgs) {
  if (isRemixResourceRequest(args.request)) {
    return json(await loadSettingsMediaData(args));
  }
  return defer({
    mediaSettings: loadSettingsMediaData(args),
  });
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    const userId = await requireUserId(request);
    await requireAnySubscription(userId);
    await requireFeatureAccess(userId, "settings");
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

      if (media.provider === "BLOSSOM_SFS") {
        try {
          await deleteRemoteBlossomObject(media.url);
        } catch {
          return json(
            {
              error:
                "Could not delete file from Blossom storage. Record was not removed.",
            },
            { status: 502 }
          );
        }
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

type SettingsMediaLoaderPayload = Awaited<
  ReturnType<typeof loadSettingsMediaData>
>;

function SettingsMediaPageInner() {
  const { items, totalCount, totalSize, storageLimitBytes, page, totalPages } =
    useDeferredRouteLoaderData() as SettingsMediaLoaderPayload;
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isDeleting =
    navigation.state === "submitting" &&
    navigation.formData?.get("_action") === "delete_media";

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Media</h1>
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
            SmartFlow Blossom (SFS) storage: files and size used from your
            account limit
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-wrap gap-6">
            <div>
              <dt className="text-muted-foreground text-sm">Files</dt>
              <dd className="text-xl font-semibold">{totalCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">Storage used</dt>
              <dd className="text-xl font-semibold">
                {formatBytes(totalSize)}
                {storageLimitBytes != null && storageLimitBytes > 0 ? (
                  <span className="text-muted-foreground ml-1 font-normal">
                    / {formatBytes(storageLimitBytes)} limit
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>
          {storageLimitBytes != null && storageLimitBytes > 0 ? (
            <div className="mt-3">
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      (100 * totalSize) / storageLimitBytes
                    )}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Media gallery</CardTitle>
          <CardDescription>
            Recent uploads from SmartFlow Blossom. Delete removes both the app
            record and the remote object.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {actionData?.error ? (
            <p className="text-destructive mb-4 text-sm">{actionData.error}</p>
          ) : null}
          {items.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No media recorded yet. Upload with SmartFlow Blossom to see items
              here.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {items.map((m) => {
                  const isImage = (m.mimeType ?? "").startsWith("image/");
                  const isVideo = (m.mimeType ?? "").startsWith("video/");
                  return (
                    <div
                      key={m.id}
                      className="border-border bg-card overflow-hidden rounded-md border"
                    >
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-muted block aspect-square"
                      >
                        {isImage ? (
                          <img
                            src={m.url}
                            alt={m.sha256 ?? "media"}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : isVideo ? (
                          <video
                            src={m.url}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                            Open media
                          </div>
                        )}
                      </a>
                      <div className="space-y-2 p-3 text-xs">
                        <div className="text-muted-foreground">
                          {m.size != null ? formatBytes(m.size) : "—"} •{" "}
                          {new Date(m.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-muted-foreground truncate">
                          {m.mimeType ?? m.provider}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary truncate hover:underline"
                          >
                            View
                          </a>
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
                              className="text-destructive hover:underline disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </Form>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {totalPages > 1 ? (
                <div className="flex flex-col gap-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
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

export default function SettingsMediaPage() {
  const { mediaSettings } = useLoaderData() as {
    mediaSettings: Promise<SettingsMediaLoaderPayload>;
  };

  return (
    <Suspense
      fallback={
        <DeferredListPageSkeleton
          variant="mediaGallery"
          title="Media"
          subtitle="Blossom usage and your uploads"
        />
      }
    >
      <Await
        resolve={mediaSettings}
        errorElement={
          <DeferredRouteAwaitError retryTo="/dashboard/settings/media" />
        }
      >
        {(loaded) => (
          <DeferredRouteLoaderProvider value={loaded}>
            <SettingsMediaPageInner />
          </DeferredRouteLoaderProvider>
        )}
      </Await>
    </Suspense>
  );
}
