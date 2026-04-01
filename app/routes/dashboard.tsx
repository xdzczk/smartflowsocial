import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";

import { refreshUserProfileIfEmpty, requireUser } from "~/features/auth";
import {
  requireDashboardSubscriptionContext,
  ensureUserHasFreePlan,
} from "~/features/payments";
import { getReferredByForNpub } from "~/features/referral/get-referred-by.server";
import { isReferralAdmin } from "~/features/referral/referral-admin.server";
import {
  DashboardLayoutPage,
  loadDashboardData,
  handleDashboardAction,
  getPendingParentRequestsForChild,
  getFeedbackInboxPubkeyHex,
  loadFeedbackInboxKind10050Relays,
} from "~/features/user";
import { withCSRFProtection } from "~/lib/csrf";
import { featureFlags } from "~/lib/feature-flags.server";
import { buildSeoMeta, siteOriginFromMatches } from "~/lib/seo";
import { NOINDEX, resolveDashboardPageLabel } from "~/lib/seo-dashboard-routes";

export const meta: MetaFunction = ({ matches, location }) => {
  const siteOrigin = siteOriginFromMatches(matches);
  const leaf = matches[matches.length - 1];
  const leafId = leaf?.id ?? "";
  const label = resolveDashboardPageLabel({
    leafId,
    search: location.search,
    leafData: leaf?.data,
  });
  return buildSeoMeta(
    {
      page: label,
      robots: NOINDEX,
    },
    { siteOrigin }
  );
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user = await requireUser(request);
  user = await refreshUserProfileIfEmpty(user);

  // New and existing users without a subscription get free plan so they land on dashboard first
  await ensureUserHasFreePlan(user.id);

  // Root dashboard requires an ACTIVE subscription (including free)
  const subscriptionData = await requireDashboardSubscriptionContext(user.id);

  // Pending parent link requests for this user (as child)
  const pendingParentNpubs = await getPendingParentRequestsForChild(user.id);

  const [dashboardData, referredBy, feedbackInboxKind10050Relays] =
    await Promise.all([
      loadDashboardData(user.id, user.npub, pendingParentNpubs),
      getReferredByForNpub(user.npub),
      loadFeedbackInboxKind10050Relays(),
    ]);

  return json({
    userId: user.id,
    user,
    currentSubscription: subscriptionData.currentSubscription,
    billingContext: subscriptionData.billingContext ?? null,
    ...dashboardData,
    referredBy: referredBy ?? undefined,
    isOperatorAdmin: isReferralAdmin(user.npub),
    feedbackInboxPubkeyHex: getFeedbackInboxPubkeyHex(),
    feedbackInboxKind10050Relays,
    nostrDmNip17Enabled: featureFlags.nostrDmNip17Enabled,
    nip88PollsEnabled: featureFlags.nip88PollsEnabled,
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
