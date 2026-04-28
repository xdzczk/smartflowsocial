import { defer, json, type LoaderFunctionArgs } from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";

import { DeferredRouteAwaitError } from "~/components/deferred-route/DeferredRouteAwaitError";
import {
  AdminAccessDenied,
  AdminOperationsPageInner,
  AdminOperationsPageSkeleton,
} from "~/features/admin";
import { adminOperationsAction } from "~/features/admin/admin-operations-action.server";
import {
  defaultRangeForAdminPath,
  parseRangePreset,
} from "~/features/admin/metrics/date-range";
import { getAdminOperationsPageData } from "~/features/admin/repositories/admin-operations-queries.server";
import type { AdminOperationsPageDTO } from "~/features/admin/repositories/admin-operations-queries.server";
import { requireUser } from "~/features/auth";
import { isReferralAdmin } from "~/features/referral/referral-admin.server";
import { DeferredRouteLoaderProvider } from "~/lib/remix/deferred-route-loader-context";
import { isRemixResourceRequest } from "~/lib/remix/is-remix-resource-request";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (!isReferralAdmin(user.npub)) {
    return json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const preset = parseRangePreset(
    url.searchParams.get("range"),
    defaultRangeForAdminPath(url.pathname)
  );
  if (isRemixResourceRequest(request)) {
    return json(await getAdminOperationsPageData(preset));
  }
  return defer({
    operations: getAdminOperationsPageData(preset),
  });
}

export const action = adminOperationsAction;

type AdminOperationsLoaderResult =
  | { error: string }
  | { operations: Promise<AdminOperationsPageDTO> };

export default function AdminOperationsPage() {
  const raw = useLoaderData() as AdminOperationsLoaderResult;
  if ("error" in raw) {
    return <AdminAccessDenied />;
  }
  const { operations } = raw;

  return (
    <Suspense fallback={<AdminOperationsPageSkeleton />}>
      <Await
        resolve={operations}
        errorElement={
          <DeferredRouteAwaitError retryTo="/dashboard/admin/operations" />
        }
      >
        {(loaded) => (
          <DeferredRouteLoaderProvider value={loaded}>
            <AdminOperationsPageInner />
          </DeferredRouteLoaderProvider>
        )}
      </Await>
    </Suspense>
  );
}
