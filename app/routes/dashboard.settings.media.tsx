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
import { Suspense, useState } from "react";

import { DeferredRouteAwaitError } from "~/components/deferred-route/DeferredRouteAwaitError";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { requireUserId } from "~/features/auth";
import {
  requireAnySubscription,
  getSubscriptionData,
} from "~/features/payments";
import { getBlossomStorageLimitBytes } from "~/features/payments/blossom-storage-limits";
import { MediaSettingsPageSkeleton } from "~/features/settings";
import {
  deleteMediaById,
  deleteRemoteBlossomObject,
  findMediaByIdForUser,
  getMediaAggregateForUser,
  listMediaForUser,
} from "~/features/upload";
import { BRAND_BLOSSOM_LABEL } from "~/lib/brand";
import { withCSRFProtection } from "~/lib/csrf";
import {
  DeferredRouteLoaderProvider,
  useDeferredRouteLoaderData,
} from "~/lib/remix/deferred-route-loader-context";
import { isRemixResourceRequest } from "~/lib/remix/is-remix-resource-request";
import { cn } from "~/lib/utils";

const PAGE_SIZE = 50;
interface ActionData {
  error?: string;
}

async function loadSettingsMediaData({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);

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
  const planId = subscriptionData.currentSubscription?.planId ?? null;
  const storageLimitBytes = getBlossomStorageLimitBytes(planId);

  return {
    items,
    totalCount,
    totalSize,
    storageLimitBytes: storageLimitBytes > 0 ? storageLimitBytes : null,
    planName: subscriptionData.currentSubscription?.Plan?.name ?? null,
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
              error: `Could not delete file from ${BRAND_BLOSSOM_LABEL}. Nothing was removed.`,
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
  const {
    items,
    totalCount,
    totalSize,
    storageLimitBytes,
    planName,
    page,
    totalPages,
  } = useDeferredRouteLoaderData() as SettingsMediaLoaderPayload;
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const submittingMediaId =
    navigation.state === "submitting" &&
    navigation.formData?.get("_action") === "delete_media"
      ? String(navigation.formData.get("mediaId") ?? "")
      : null;

  const usagePercent =
    storageLimitBytes != null && storageLimitBytes > 0
      ? Math.min(100, (100 * totalSize) / storageLimitBytes)
      : 0;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl space-y-2">
          <h1 className="text-xl font-semibold sm:text-2xl">Media</h1>
          <p className="text-text-secondary text-sm leading-relaxed">
            Manage media uploaded through {BRAND_BLOSSOM_LABEL}. Deleting
            removes the library entry and the stored file when the server
            confirms removal. If deletion fails, the item stays and you will see
            an error.
          </p>
        </div>
        <Link
          to="/dashboard/settings?tab=media"
          className="text-link hover:text-link-hover shrink-0 text-sm hover:underline"
        >
          Back to Media &amp; Storage
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <CardTitle className="text-base">Usage</CardTitle>
              <CardDescription className="mt-1">
                {BRAND_BLOSSOM_LABEL} storage tracked for your account.
                {planName ? (
                  <>
                    {" "}
                    <span className="text-text/80">
                      Included in your current plan ({planName}).
                    </span>
                  </>
                ) : null}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-text-secondary text-xs font-medium tracking-wide uppercase">
                Files
              </dt>
              <dd className="text-lg font-semibold tabular-nums">
                {totalCount}
              </dd>
            </div>
            <div className="col-span-2 sm:col-span-2">
              <dt className="text-text-secondary text-xs font-medium tracking-wide uppercase">
                Storage used
              </dt>
              <dd className="text-lg font-semibold tabular-nums">
                {formatBytes(totalSize)}
                {storageLimitBytes != null && storageLimitBytes > 0 ? (
                  <span className="text-text-secondary ml-1 text-base font-normal">
                    / {formatBytes(storageLimitBytes)}
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>
          {storageLimitBytes != null && storageLimitBytes > 0 ? (
            <div>
              <div className="bg-surface-hover mb-1 h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-brand h-full rounded-full transition-all"
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <p className="text-text-secondary text-xs">
                {usagePercent >= 95
                  ? `You are near your ${BRAND_BLOSSOM_LABEL} storage limit.`
                  : `Usage is counted for ${BRAND_BLOSSOM_LABEL} uploads only.`}
              </p>
            </div>
          ) : (
            <p className="text-text-secondary text-xs">
              Storage limits apply when your plan includes a{" "}
              {BRAND_BLOSSOM_LABEL} quota.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Library</CardTitle>
          <CardDescription>
            Only {BRAND_BLOSSOM_LABEL} uploads appear here. Other providers may
            not be listed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {actionData?.error ? (
            <p className="text-danger mb-4 text-sm">{actionData.error}</p>
          ) : null}
          {items.length === 0 ? (
            <div className="text-text-secondary space-y-2 text-sm leading-relaxed">
              <p>No media yet.</p>
              <p>
                Upload with {BRAND_BLOSSOM_LABEL} as your media provider in
                Media &amp; Storage settings. Items will show a preview, size,
                and delete action once recorded.
              </p>
              <p>
                <Link
                  to="/dashboard/settings?tab=media"
                  className="text-link hover:text-link-hover font-medium hover:underline"
                >
                  Media &amp; Storage settings
                </Link>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <ul className="flex flex-col gap-3">
                {items.map((m) => {
                  const isImage = (m.mimeType ?? "").startsWith("image/");
                  const isVideo = (m.mimeType ?? "").startsWith("video/");
                  return (
                    <li
                      key={m.id}
                      className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-stretch"
                    >
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-surface-hover relative h-36 w-full shrink-0 overflow-hidden rounded-md sm:h-28 sm:w-40"
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
                          <div className="text-text-secondary flex h-full items-center justify-center text-xs">
                            File
                          </div>
                        )}
                      </a>
                      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <p className="text-text-secondary text-xs">
                            {m.mimeType ?? "Unknown type"} ·{" "}
                            {m.size != null ? formatBytes(m.size) : "—"} ·{" "}
                            {new Date(m.createdAt).toLocaleString()}
                          </p>
                          <p className="text-text-secondary truncate text-xs">
                            {BRAND_BLOSSOM_LABEL}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-link hover:text-link-hover text-sm font-medium hover:underline"
                          >
                            Open
                          </a>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-danger hover:text-danger h-auto px-0"
                            disabled={!!submittingMediaId}
                            onClick={() => setDeleteTargetId(m.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {totalPages > 1 ? (
                <div className="stack-tight pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <Link
                    to={`/dashboard/settings/media?page=${page - 1}`}
                    className={
                      page <= 1
                        ? "text-text-secondary pointer-events-none"
                        : "text-link hover:text-link-hover hover:underline"
                    }
                  >
                    Previous
                  </Link>
                  <span className="text-text-secondary text-sm">
                    Page {page} of {totalPages}
                  </span>
                  <Link
                    to={`/dashboard/settings/media?page=${page + 1}`}
                    className={
                      page >= totalPages
                        ? "text-text-secondary pointer-events-none"
                        : "text-link hover:text-link-hover hover:underline"
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

      <AlertDialog
        open={deleteTargetId != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this media?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the file from {BRAND_BLOSSOM_LABEL} storage and
              deletes your library record when the server confirms removal. If
              removal fails, nothing changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <Form method="post" className="inline">
              <input type="hidden" name="_action" value="delete_media" />
              <input
                type="hidden"
                name="mediaId"
                value={deleteTargetId ?? ""}
              />
              <Button
                type="submit"
                variant="destructive"
                className={cn(
                  submittingMediaId && "pointer-events-none opacity-70"
                )}
                disabled={!deleteTargetId || !!submittingMediaId}
              >
                {submittingMediaId === deleteTargetId ? "Deleting…" : "Delete"}
              </Button>
            </Form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function SettingsMediaPage() {
  const { mediaSettings } = useLoaderData() as {
    mediaSettings: Promise<SettingsMediaLoaderPayload>;
  };

  return (
    <Suspense fallback={<MediaSettingsPageSkeleton />}>
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
