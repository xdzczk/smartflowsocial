import { defer, json, type LoaderFunctionArgs } from "@remix-run/node";
import { Await, Outlet, useLoaderData, useLocation } from "@remix-run/react";
import { Suspense } from "react";

import { requireUserId } from "~/features/auth";
import type { ProfileData as _ProfileData } from "~/features/nostr/types";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import {
  SettingsAwaitError,
  SettingsPage,
  SettingsPageSkeleton,
  SettingsResolvedLoaderProvider,
  handleSettingsAction,
} from "~/features/settings";
import {
  SETTINGS_LOADER_FALLBACK,
  loadSettingsData,
  type SettingsLoaderData,
} from "~/features/settings/settings-loader.server";
import { withCSRFProtection } from "~/lib/csrf";
import { logError } from "~/lib/error-logger.server";

async function loadSettingsOrThrow(
  userId: string
): Promise<SettingsLoaderData> {
  return loadSettingsData(userId);
}

async function loaderImpl({ request }: Pick<LoaderFunctionArgs, "request">) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "settings");

  const url = new URL(request.url);
  const isDataRequest = url.searchParams.has("_data");

  if (isDataRequest) {
    try {
      return json(await loadSettingsOrThrow(userId));
    } catch (error) {
      const { handleLoaderError } = await import("~/lib/error-handler.server");
      return handleLoaderError(error, SETTINGS_LOADER_FALLBACK);
    }
  }

  const settingsPromise = (async (): Promise<SettingsLoaderData> => {
    try {
      return await loadSettingsOrThrow(userId);
    } catch (error: unknown) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        message:
          "Settings deferred load failed; returning SETTINGS_LOADER_FALLBACK",
        userId,
      });
      return SETTINGS_LOADER_FALLBACK;
    }
  })();

  return defer({
    settings: settingsPromise,
  });
}

export async function loader(args: LoaderFunctionArgs) {
  try {
    return await loaderImpl(args);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, SETTINGS_LOADER_FALLBACK);
  }
}

export const action = withCSRFProtection(
  async ({ request }: { request: Request }) => {
    const userId = await requireUserId(request);
    const formData = await request.formData();

    try {
      return await handleSettingsAction(userId, formData);
    } catch (error) {
      // Use centralized error handling
      const { handleActionError } = await import("~/lib/error-handler.server");
      const { logError: logErr } = await import("~/lib/error-logger.server");
      const { normalizeError } = await import("~/lib/errors");

      // Log additional context for debugging
      const normalizedError = normalizeError(error);
      logErr(normalizedError, {
        userId,
        path: request.url,
        method: request.method,
        action: formData.get("_action"),
        formDataEntries: Object.fromEntries(formData.entries()),
      });

      return handleActionError(error);
    }
  }
);

interface SettingsDeferredLoaderData {
  settings: Promise<SettingsLoaderData>;
}

function SettingsIndexRoute() {
  const { settings } = useLoaderData<SettingsDeferredLoaderData>();

  return (
    <Suspense fallback={<SettingsPageSkeleton />}>
      <Await resolve={settings} errorElement={<SettingsAwaitError />}>
        {(data) => (
          <SettingsResolvedLoaderProvider value={data as SettingsLoaderData}>
            <SettingsPage />
          </SettingsResolvedLoaderProvider>
        )}
      </Await>
    </Suspense>
  );
}

export default function DashboardSettingsRoute() {
  const location = useLocation();

  // Child routes under /dashboard/settings/* (e.g. /dashboard/settings/media)
  // must render through Outlet; otherwise navigation appears to do nothing.
  if (location.pathname.startsWith("/dashboard/settings/")) {
    return <Outlet />;
  }

  return <SettingsIndexRoute />;
}
