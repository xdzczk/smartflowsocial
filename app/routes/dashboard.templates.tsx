import {
  defer,
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";

import { DeferredRouteAwaitError } from "~/components/deferred-route/DeferredRouteAwaitError";
import { TemplatesPageSkeleton } from "~/components/skeletons/RoutePageSkeletons";
import { requireUserId } from "~/features/auth";
import { requireAnySubscription } from "~/features/payments";
import {
  TemplatesPage,
  handleTemplatesAction,
  loadTemplatesData,
} from "~/features/templates";
import { withCSRFProtection } from "~/lib/csrf";
import { DeferredRouteLoaderProvider } from "~/lib/remix/deferred-route-loader-context";
import { isRemixResourceRequest } from "~/lib/remix/is-remix-resource-request";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import {
  templatesLoaderDataSchema,
  type TemplatesLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";

async function loadTemplatesValidated(
  userId: string
): Promise<TemplatesLoaderData> {
  await requireAnySubscription(userId);
  const data = await loadTemplatesData(userId);
  return validateLoaderResponse(data, templatesLoaderDataSchema);
}

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  if (isRemixResourceRequest(request)) {
    return json(await loadTemplatesValidated(userId));
  }

  return defer({
    templates: loadTemplatesValidated(userId),
  });
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      const userId = await requireUserId(request);
      const formData = await request.formData();
      const result = await handleTemplatesAction(formData, userId);

      if (result instanceof Response) {
        return result;
      }

      if (typeof result === "object" && "error" in result && result.error) {
        return json(result, { status: 400 });
      }

      return json(result);
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

interface TemplatesDeferredLoaderData {
  templates: Promise<TemplatesLoaderData>;
}

function TemplatesFeedRoute() {
  const { templates } = useLoaderData() as TemplatesDeferredLoaderData;

  return (
    <Suspense fallback={<TemplatesPageSkeleton />}>
      <Await
        resolve={templates}
        errorElement={
          <DeferredRouteAwaitError retryTo="/dashboard/templates" />
        }
      >
        {(data) => (
          <DeferredRouteLoaderProvider value={data}>
            <TemplatesPage />
          </DeferredRouteLoaderProvider>
        )}
      </Await>
    </Suspense>
  );
}

export default TemplatesFeedRoute;
