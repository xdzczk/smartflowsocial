import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";

import { requireUser } from "~/features/auth";
import {
  requireActiveSubscription,
  ensureUserHasFreePlan,
} from "~/features/payments";
import {
  DashboardLayoutPage,
  loadDashboardData,
  handleDashboardAction,
  getPendingParentRequestsForChild,
} from "~/features/user";
import { withCSRFProtection } from "~/lib/csrf";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireUser(request);

  // New and existing users without a subscription get free plan so they land on dashboard first
  await ensureUserHasFreePlan(user.id);

  // Root dashboard requires an ACTIVE subscription (including free)
  const subscriptionData = await requireActiveSubscription(user.id);

  // Pending parent link requests for this user (as child)
  const pendingParentNpubs = await getPendingParentRequestsForChild(user.id);

  const dashboardData = await loadDashboardData(
    user.id,
    user.npub,
    pendingParentNpubs
  );

  return json({
    userId: user.id,
    user: subscriptionData.user,
    currentSubscription: subscriptionData.currentSubscription,
    ...dashboardData,
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
