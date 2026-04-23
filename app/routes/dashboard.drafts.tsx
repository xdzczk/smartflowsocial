import {
  defer,
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";

import { DeferredRouteAwaitError } from "~/components/deferred-route/DeferredRouteAwaitError";
import { requireUserId } from "~/features/auth";
import { requireAnySubscription } from "~/features/payments";
import { DraftsPage } from "~/features/posts/drafts";
import { DraftsPageSkeleton } from "~/features/posts/drafts/DraftsPageSkeleton";
import type { LongFormPostType as _LongFormPostType } from "~/features/posts/server";
import {
  handleDraftsAction,
  loadDraftsData,
} from "~/features/posts/server/drafts";
import { withCSRFProtection } from "~/lib/csrf";
import { DeferredRouteLoaderProvider } from "~/lib/remix/deferred-route-loader-context";
import { isRemixResourceRequest } from "~/lib/remix/is-remix-resource-request";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import {
  draftsLoaderDataSchema,
  type DraftsLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";

async function loadDraftsValidated(
  request: Request,
  params: LoaderFunctionArgs["params"]
): Promise<DraftsLoaderData> {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);

  const url = new URL(request.url);
  const queueType =
    url.searchParams.get("queueType") ?? params["queueType"] ?? "all";
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = 20;

  const data = await loadDraftsData(userId, queueType, page, limit);
  return validateLoaderResponse(data, draftsLoaderDataSchema);
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    if (isRemixResourceRequest(request)) {
      return json(await loadDraftsValidated(request, params));
    }
    return defer({
      drafts: loadDraftsValidated(request, params),
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {});
  }
}

function normalizeDraftsSearch(url: URL): string {
  const params = new URLSearchParams(url.search);
  // ?tab is a client-only content-type filter; the loader never reads it.
  params.delete("tab");
  return params.toString();
}

export function shouldRevalidate(args: {
  currentUrl: URL;
  nextUrl: URL;
  formAction?: string;
  defaultShouldRevalidate: boolean;
}): boolean {
  const isDraftsAction =
    typeof args.formAction === "string" &&
    args.formAction.includes("/dashboard/drafts");

  if (isDraftsAction) {
    return true;
  }

  if (args.currentUrl.pathname !== args.nextUrl.pathname) {
    return args.defaultShouldRevalidate;
  }

  // Skip revalidation when only client-only params changed.
  // The loader reads ?queueType and ?page — those still trigger revalidation.
  if (
    normalizeDraftsSearch(args.currentUrl) ===
    normalizeDraftsSearch(args.nextUrl)
  ) {
    return false;
  }

  return args.defaultShouldRevalidate;
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      const userId = await requireUserId(request);
      const formData = await request.formData();
      const result = await handleDraftsAction(formData, userId);

      if (result instanceof Response) {
        return result;
      }

      if (typeof result === "object" && "error" in result && result.error) {
        return json(result, { status: 400 });
      }

      return json(result);
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

interface DraftsDeferredLoaderData {
  drafts: Promise<DraftsLoaderData>;
}

function DraftsFeedRoute() {
  const { drafts } = useLoaderData() as DraftsDeferredLoaderData;

  return (
    <Suspense fallback={<DraftsPageSkeleton />}>
      <Await
        resolve={drafts}
        errorElement={<DeferredRouteAwaitError retryTo="/dashboard/drafts" />}
      >
        {(data) => (
          <DeferredRouteLoaderProvider value={data}>
            <DraftsPage />
          </DeferredRouteLoaderProvider>
        )}
      </Await>
    </Suspense>
  );
}

export default DraftsFeedRoute;
