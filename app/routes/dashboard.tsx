import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";

import { refreshUserProfileIfEmpty, requireUser } from "~/features/auth";
import {
  requireActiveSubscription,
  ensureUserHasFreePlan,
} from "~/features/payments";
import { getReferredByForNpub } from "~/features/referral/get-referred-by.server";
import {
  DashboardLayoutPage,
  loadDashboardData,
  handleDashboardAction,
  getPendingParentRequestsForChild,
} from "~/features/user";
import { withCSRFProtection } from "~/lib/csrf";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user = await requireUser(request);
  user = await refreshUserProfileIfEmpty(user);

  // New and existing users without a subscription get free plan so they land on dashboard first
  await ensureUserHasFreePlan(user.id);

  // Root dashboard requires an ACTIVE subscription (including free)
  const subscriptionData = await requireActiveSubscription(user.id);

  // Pending parent link requests for this user (as child)
  const pendingParentNpubs = await getPendingParentRequestsForChild(user.id);

  const [dashboardData, referredBy] = await Promise.all([
    loadDashboardData(user.id, user.npub, pendingParentNpubs),
    getReferredByForNpub(user.npub),
  ]);

  return json({
    userId: user.id,
    user,
    currentSubscription: subscriptionData.currentSubscription,
    ...dashboardData,
    referredBy: referredBy ?? undefined,
  });
};

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    const user = await requireUser(request);
    const formData = await request.formData();
    return handleDashboardAction(formData, user.id, user.npub);
  }
);

export default DashboardLayoutPage;
