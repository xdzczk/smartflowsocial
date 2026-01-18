import { json, type LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import type { ProfileData as _ProfileData } from "~/features/nostr/types";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import { SettingsPage } from "~/features/settings";
import { handleSettingsAction } from "~/features/settings/settings-actions.server";
import { loadSettingsData } from "~/features/settings/settings-loader.server";
import { withCSRFProtection } from "~/lib/csrf";
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);

    // Require that the user has at least a subscription record
    await requireAnySubscription(userId);
    // Check if user has access to settings feature (requires active subscription)
    await requireFeatureAccess(userId, "settings");

    const data = await loadSettingsData(userId);
    return json(data);
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId, requireAnySubscription, or requireFeatureAccess), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    // Provide default data structure matching what the component expects
    return handleLoaderError(error, {
      timezone: "Etc/GMT",
      relays: [],
      giveawayBlacklist: [],
      scheduleIntervals: [],
      queueTypes: [],
      uploadProvider: null,
      enableMirrorBlossom: false,
      mirrorUploadUrls: [],
      hashTagPresets: [],
      nwcEnabled: false,
      maskedNwcString: null,
      nwcLastUsed: null,
      subscription: null,
      availablePlans: [],
      paymentHistory: [],
      isChild: false,
      hasAccountsAccess: false,
      accounts: null,
      mutedList: { npubs: [], lastSynced: new Date().toISOString() },
      filterMuted: false,
      hidePostsFromLowTrustUsers: false,
    });
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
      const { logError } = await import("~/lib/error-logger.server");
      const { normalizeError } = await import("~/lib/errors");

      // Log additional context for debugging
      const normalizedError = normalizeError(error);
      logError(normalizedError, {
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
export default SettingsPage;
