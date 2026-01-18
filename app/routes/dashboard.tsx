import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";

import { requireUser } from "~/features/auth";
import { requireActiveSubscription } from "~/features/payments";
import {
  DashboardLayoutPage,
  loadDashboardData,
  handleDashboardAction,
  getPendingParentRequestsForChild,
} from "~/features/user";
import { withCSRFProtection } from "~/lib/csrf";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireUser(request);

  // Root dashboard also requires an ACTIVE subscription
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
