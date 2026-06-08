import {
  Outlet,
  useLoaderData,
  useRouteLoaderData,
  Link,
  useLocation,
  useNavigation,
} from "@remix-run/react";
import { useState } from "react";
import type { ReactNode } from "react";

import { BroadcastAudiencesPageSkeleton } from "~/components/broadcast/BroadcastAudiencesPageSkeleton";
import { BroadcastDetailPageSkeleton } from "~/components/broadcast/BroadcastDetailPageSkeleton";
import { BroadcastIndexPageSkeleton } from "~/components/broadcast/BroadcastIndexPageSkeleton";
import { BroadcastNewPageSkeleton } from "~/components/broadcast/BroadcastNewPageSkeleton";
import { BroadcastReviewPageSkeleton } from "~/components/broadcast/BroadcastReviewPageSkeleton";
import Footer from "~/components/layout/DashboardFooter";
import Header from "~/components/layout/DashboardHeader";
import {
  DASHBOARD_MAIN_BAND_CLASS,
  DASHBOARD_MAIN_BAND_FULL_WIDTH_CLASS,
} from "~/components/layout/page-layout-constants";
import { ComposerSkeleton } from "~/components/skeletons/ComposerSkeleton";
import { DashboardSkeleton } from "~/components/skeletons/DashboardSkeleton";
import { BannerDismissButton } from "~/components/ui/BannerDismissButton";
import { Skeleton } from "~/components/ui/skeleton";
import { AdminAnalyticsPageSkeleton } from "~/features/admin/components/AdminAnalyticsPageSkeleton";
import { AdminOperationsPageSkeleton } from "~/features/admin/components/AdminOperationsPageSkeleton";
import { AdminUsersPageSkeleton } from "~/features/admin/components/AdminUsersPageSkeleton";
import { ContestDetailPageSkeleton } from "~/features/contest/components/ContestDetailPageSkeleton";
import { ContestProofPageSkeleton } from "~/features/contest/components/ContestProofPageSkeleton";
import { EngagementFeedSkeleton } from "~/features/engagement/components/EngagementFeedSkeleton";
import { GiveawayBuilderPageSkeleton } from "~/features/giveaway/components/GiveawayBuilderPageSkeleton";
import { GiveawayDetailPageSkeleton } from "~/features/giveaway/components/GiveawayDetailPageSkeleton";
import { GiveawayProofPageSkeleton } from "~/features/giveaway/components/GiveawayProofPageSkeleton";
import {
  BillingAlertBanner,
  getUserPlanType,
  isSubscriptionExpiredForUi,
} from "~/features/payments";
import type { BillingContext } from "~/features/payments/types/subscription-billing.types";
import { CalendarPageSkeleton } from "~/features/posts/calendar/CalendarPageSkeleton";
import { CalendarQueuePageSkeleton } from "~/features/posts/calendar/CalendarQueuePageSkeleton";
import { BulkPostsPageSkeleton } from "~/features/posts/components/BulkPostsPageSkeleton";
import { CreateComposerShell } from "~/features/posts/composer/components/CreateComposerShell";
import { DraftsPageSkeleton } from "~/features/posts/drafts/DraftsPageSkeleton";
import { PublishedPostsPageSkeleton } from "~/features/posts/publishing/PublishedPostsPageSkeleton";
import { RecyclablesPageSkeleton } from "~/features/posts/publishing/RecyclablesPageSkeleton";
import { ScheduledPostsPageSkeleton } from "~/features/posts/scheduling/ScheduledPostsPageSkeleton";
import { ReferredByBanner } from "~/features/referral/components/ReferredByBanner";
import { MediaSettingsPageSkeleton } from "~/features/settings/components/MediaSettingsPageSkeleton";
import { SettingsPageSkeleton } from "~/features/settings/components/SettingsPageSkeleton";
import { TemplatesPageSkeleton } from "~/features/templates/components/TemplatesPageSkeleton";
import { PendingParentRequestBanner } from "~/features/user/components/PendingParentRequestBanner";
import { useSessionDismissedBanner } from "~/lib/hooks/useSessionDismissedBanner";
import { useProductSessionTelemetry } from "~/lib/telemetry/product-session";
import type { loader as dashboardLoader } from "~/routes/dashboard";

const DESKTOP_SIDEBAR_OPEN_KEY = "dashboard-desktop-sidebar-open";
const DASHBOARD_INDEX_PATH = "/dashboard";
const DASHBOARD_BROADCASTS_PATH = "/dashboard/broadcasts";
const SUBSCRIPTION_EXPIRED_BANNER_DISMISSED_KEY =
  "smartflowsocial:dismissed-subscription-expired-banner";

function isDashboardIndexPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/";
  return normalized === DASHBOARD_INDEX_PATH;
}

/** Calendar route: lock viewport height on desktop so only the time grid scrolls. */
function isCalendarPath(pathname: string): boolean {
  return pathname.startsWith("/dashboard/calendar");
}

const BROADCASTS_SCROLLABLE_LIST_PATHS = new Set([
  DASHBOARD_BROADCASTS_PATH,
  `${DASHBOARD_BROADCASTS_PATH}/audiences`,
  `${DASHBOARD_BROADCASTS_PATH}/suppression`,
  `${DASHBOARD_BROADCASTS_PATH}/settings`,
]);

/** Broadcasts builder/detail: lock shell height and scroll `main` so sticky footers/rails work without double scroll. */
function isBroadcastsViewportLockedPath(pathname: string): boolean {
  if (!pathname.startsWith(DASHBOARD_BROADCASTS_PATH)) return false;
  // List + settings surfaces share the same scroll shell as Giveaways / Contests.
  return !BROADCASTS_SCROLLABLE_LIST_PATHS.has(pathname);
}

function isComposePath(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard/compose") ||
    pathname === "/dashboard/newpost" ||
    pathname === "/dashboard/newlongformpost"
  );
}

function pendingSkeletonForPath(pathname: string): ReactNode {
  if (isDashboardIndexPath(pathname)) {
    return <DashboardSkeleton />;
  }
  if (/^\/dashboard\/calendar\/[^/]+$/.test(pathname)) {
    return <CalendarQueuePageSkeleton />;
  }
  if (pathname.startsWith("/dashboard/admin/analytics")) {
    return <AdminAnalyticsPageSkeleton />;
  }
  if (pathname.startsWith("/dashboard/admin/users")) {
    return <AdminUsersPageSkeleton />;
  }
  if (pathname.startsWith("/dashboard/admin/operations")) {
    return <AdminOperationsPageSkeleton />;
  }
  if (pathname.startsWith("/dashboard/broadcasts/new/review")) {
    return <BroadcastReviewPageSkeleton />;
  }
  if (pathname.startsWith("/dashboard/broadcasts/new")) {
    return <BroadcastNewPageSkeleton />;
  }
  if (pathname.startsWith("/dashboard/broadcasts/audiences")) {
    return <BroadcastAudiencesPageSkeleton />;
  }
  if (/^\/dashboard\/broadcasts\/[^/]+$/.test(pathname)) {
    return <BroadcastDetailPageSkeleton />;
  }
  if (pathname.startsWith("/dashboard/broadcasts")) {
    return <BroadcastIndexPageSkeleton />;
  }
  if (pathname.startsWith("/dashboard/calendar")) {
    return <CalendarPageSkeleton />;
  }
  if (pathname.startsWith("/dashboard/drafts")) {
    return <DraftsPageSkeleton />;
  }
  if (pathname.startsWith("/dashboard/published")) {
    return <PublishedPostsPageSkeleton />;
  }
  if (pathname.startsWith("/dashboard/scheduled")) {
    return <ScheduledPostsPageSkeleton />;
  }
  if (pathname.startsWith("/dashboard/templates")) {
    return <TemplatesPageSkeleton />;
  }
  if (pathname.startsWith("/dashboard/recyclables")) {
    return <RecyclablesPageSkeleton />;
  }
  if (pathname.startsWith("/dashboard/bulkposts")) {
    return <BulkPostsPageSkeleton />;
  }
  if (pathname.startsWith("/dashboard/settings/media")) {
    return <MediaSettingsPageSkeleton />;
  }
  if (pathname.startsWith("/dashboard/settings")) {
    return <SettingsPageSkeleton />;
  }
  if (pathname.startsWith("/dashboard/giveaway/new")) {
    return <GiveawayBuilderPageSkeleton />;
  }
  if (pathname.startsWith("/dashboard/giveaway/detail/")) {
    return <GiveawayDetailPageSkeleton />;
  }
  if (pathname.startsWith("/dashboard/giveaway/proof")) {
    return <GiveawayProofPageSkeleton />;
  }
  if (pathname.startsWith("/dashboard/contests/detail/")) {
    return <ContestDetailPageSkeleton />;
  }
  if (pathname.startsWith("/dashboard/contests/proof")) {
    return <ContestProofPageSkeleton />;
  }
  if (pathname.startsWith("/dashboard/engagement/feed")) {
    return <EngagementFeedSkeleton />;
  }
  return <ScheduledPostsPageSkeleton />;
}

function pendingComposeContentType(
  pathname: string,
  search: string
): "post" | "poll" | "thread" | "article" {
  if (pathname === "/dashboard/newlongformpost") return "article";
  if (pathname === "/dashboard/newpost") return "post";
  if (pathname === "/dashboard/compose/article") return "article";
  const q = search.startsWith("?") ? search.slice(1) : search;
  const type = new URLSearchParams(q).get("type");
  if (type === "poll") return "poll";
  if (type === "thread") return "thread";
  if (type === "article") return "article";
  return "post";
}

function composeShellTitle(
  contentType: "post" | "poll" | "thread" | "article"
): string {
  if (contentType === "poll") return "Create poll";
  if (contentType === "thread") return "Create thread";
  if (contentType === "article") return "Create article";
  return "Create post";
}

type DashboardNavigation = ReturnType<typeof useNavigation>;
type DashboardLocation = ReturnType<typeof useLocation>;

function getNavigationFormValue(
  formData: FormData | undefined,
  key: string
): string | undefined {
  const value = formData?.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getPendingNavigationState(
  navigation: DashboardNavigation,
  location: DashboardLocation
): {
  navAction: string | undefined;
  navParentNpub: string | undefined;
  navDecision: string | undefined;
  pendingPathname: string;
  pendingComposeType: "post" | "poll" | "thread" | "article";
  showPendingComposeSkeleton: boolean;
  showPendingDashboardSkeleton: boolean;
} {
  const formData = navigation.formData;
  const navAction = getNavigationFormValue(formData, "_action");
  const navParentNpub = getNavigationFormValue(formData, "parentNpub");
  const navDecision = getNavigationFormValue(formData, "decision");
  const pendingPathname = navigation.location?.pathname ?? "";
  const pendingSearch = navigation.location?.search ?? "";
  const hasPendingTarget = pendingPathname.length > 0;
  // Only treat it as a "route change" when the pathname itself changes.
  // Same-pathname filter/search-param changes (e.g. ?tab=, ?queueType=) should
  // not replace the Outlet with the full-page skeleton  -  the heading, filter
  // bar, and rail are stable, and the route-level Suspense handles content-area
  // loading if the loader actually re-runs.
  const pendingRouteChanged =
    hasPendingTarget && pendingPathname !== location.pathname;
  const showPendingComposeSkeleton =
    navigation.state === "loading" &&
    isComposePath(pendingPathname) &&
    !isComposePath(location.pathname);
  const showPendingDashboardSkeleton =
    navigation.state === "loading" &&
    pendingRouteChanged &&
    pendingPathname.startsWith("/dashboard") &&
    !isComposePath(pendingPathname);

  return {
    navAction,
    navParentNpub,
    navDecision,
    pendingPathname,
    pendingComposeType: pendingComposeContentType(
      pendingPathname,
      pendingSearch
    ),
    showPendingComposeSkeleton,
    showPendingDashboardSkeleton,
  };
}

export function DashboardLayoutPage(): ReactNode {
  const location = useLocation();
  const data = useLoaderData<typeof dashboardLoader>();
  useProductSessionTelemetry(Boolean(data.userId));
  const layoutData =
    useRouteLoaderData<typeof dashboardLoader>("routes/dashboard");
  const {
    currentSubscription,
    billingContext,
    pendingParentUsers,
    referredBy,
  } = data as typeof data & {
    billingContext?: BillingContext | null;
  };
  /** Prefer parent layout loader so nested routes still get the flag. */
  const isOperatorAdmin = Boolean(
    layoutData?.isOperatorAdmin ??
    (data as { isOperatorAdmin?: boolean }).isOperatorAdmin
  );
  const planType = getUserPlanType(currentSubscription ?? null);
  const isFreePlan = planType === "free";
  const isDashboardIndex = isDashboardIndexPath(location.pathname);
  const isCalendar = isCalendarPath(location.pathname);
  const isBroadcastsViewportLocked = isBroadcastsViewportLockedPath(
    location.pathname
  );
  const isSubscriptionExpired = isSubscriptionExpiredForUi(
    currentSubscription ?? null
  );
  const showBillingAlert =
    billingContext != null &&
    billingContext.bannerVariant !== "none" &&
    !isFreePlan;
  const navigation = useNavigation();
  const {
    navAction,
    navParentNpub,
    navDecision,
    pendingPathname,
    pendingComposeType,
    showPendingComposeSkeleton,
    showPendingDashboardSkeleton,
  } = getPendingNavigationState(navigation, location);
  const pendingDashboardSkeleton = pendingSkeletonForPath(pendingPathname);

  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(DESKTOP_SIDEBAR_OPEN_KEY) !== "false";
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const {
    isDismissed: isSubscriptionExpiredBannerDismissed,
    dismiss: dismissSubscriptionExpiredBanner,
  } = useSessionDismissedBanner(SUBSCRIPTION_EXPIRED_BANNER_DISMISSED_KEY);
  const shouldShowSubscriptionExpiredBanner =
    isSubscriptionExpired && !isSubscriptionExpiredBannerDismissed;

  const handleDesktopSidebarToggle = () => {
    setDesktopSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem(DESKTOP_SIDEBAR_OPEN_KEY, String(next));
      return next;
    });
  };

  return (
    <>
      <div
        id="page-container"
        data-dashboard-shell
        className={`bg-canvas mx-auto flex w-full min-w-0 flex-col ${
          isBroadcastsViewportLocked
            ? "h-dvh max-h-dvh min-h-0 overflow-hidden"
            : "min-h-dvh"
        } ${isCalendar ? "h-dvh overflow-x-visible" : ""} ${isDashboardIndex ? "lg:h-dvh lg:overflow-hidden" : ""} ${desktopSidebarOpen ? "lg:pl-64" : "lg:pl-12"}`}
        {...(mobileSidebarOpen ? { "data-mobile-sidebar-open": "" } : {})}
      >
        <Header
          desktopSidebarOpen={desktopSidebarOpen}
          onDesktopSidebarToggle={handleDesktopSidebarToggle}
          mobileSidebarOpen={mobileSidebarOpen}
          onMobileSidebarOpenChange={setMobileSidebarOpen}
          isOperatorAdmin={isOperatorAdmin}
        />

        {/* No overflow-x-hidden: it forces overflow-y to compute to auto and breaks position:sticky summary rails in dashboard builders.
            pt-header = --header-h + env(safe-area-inset-top) so content clears the notch on installed iOS PWAs. */}
        <main
          id="page-content"
          className={`pt-header flex min-h-0 max-w-full min-w-0 flex-1 flex-col ${
            isCalendar ? "overflow-hidden" : ""
          } ${isBroadcastsViewportLocked ? "overflow-y-auto overscroll-y-contain" : ""}`}
        >
          {referredBy != null ? (
            <ReferredByBanner
              referrerNpub={referredBy.referrerNpub}
              referrerDisplayName={referredBy.referrerDisplayName ?? null}
            />
          ) : null}
          {pendingParentUsers.length > 0 ? (
            <div className={`${DASHBOARD_MAIN_BAND_FULL_WIDTH_CLASS} pt-4`}>
              {pendingParentUsers.map((p) => {
                const isThisSubmitting =
                  navigation.state === "submitting" &&
                  navAction === "respond_child_request" &&
                  navParentNpub === p.npub;
                return (
                  <PendingParentRequestBanner
                    key={p.npub}
                    parentNpub={p.npub}
                    nostrProfile={p.nostrProfile}
                    isSubmitting={isThisSubmitting}
                    submitDecision={
                      isThisSubmitting ? (navDecision ?? null) : null
                    }
                  />
                );
              })}
            </div>
          ) : null}

          {showBillingAlert ? (
            <BillingAlertBanner billingContext={billingContext} />
          ) : shouldShowSubscriptionExpiredBanner ? (
            <div className={`${DASHBOARD_MAIN_BAND_FULL_WIDTH_CLASS} pt-4`}>
              <div className="border-border bg-surface-hover text-text-secondary mb-4 flex items-start justify-between gap-3 rounded-lg border p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Your subscription has expired.</p>
                  <p className="text-sm opacity-90">
                    You’re on Free now. Resubscribe to restore your previous
                    plan benefits.
                  </p>
                </div>
                <div className="cluster-tight.5 self-start md:ml-4 md:shrink-0">
                  <Link
                    prefetch="intent"
                    to="/plans"
                    className="focus-ring-offset bg-action-primary text-action-primary-foreground hover:bg-action-primary/90 inline-flex items-center rounded-md px-3 py-2 text-sm font-medium"
                  >
                    Restore plan
                  </Link>
                  <BannerDismissButton
                    ariaLabel="Dismiss subscription expired banner"
                    onClick={dismissSubscriptionExpiredBanner}
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div
            className={`flex w-full min-w-0 flex-1 flex-col ${isCalendar ? "min-h-0 min-w-0 pt-0 pb-0" : isDashboardIndex ? "pt-4.5 pb-6 md:pb-8 lg:min-h-0 lg:overflow-y-auto lg:pt-4 lg:pb-3" : `${isBroadcastsViewportLocked ? "min-h-0" : ""}pt-4.5 pb-24`} ${isCalendar || isDashboardIndex ? "" : DASHBOARD_MAIN_BAND_CLASS}`}
          >
            {showPendingComposeSkeleton ? (
              <div className="animate-in fade-in-0 duration-200">
                <CreateComposerShell
                  contentType={pendingComposeType}
                  onContentTypeChange={() => {}}
                  title={composeShellTitle(pendingComposeType)}
                  reserveTitleStatusSlot
                  composerHeaderActions={
                    <div
                      className="pointer-events-none flex shrink-0 items-center gap-0.5 sm:gap-1"
                      aria-hidden
                    >
                      <Skeleton className="h-8 w-[3.25rem] rounded-md" />
                      <Skeleton className="h-8 w-[4.5rem] rounded-md" />
                    </div>
                  }
                >
                  <ComposerSkeleton />
                </CreateComposerShell>
              </div>
            ) : showPendingDashboardSkeleton ? (
              <div className="animate-in fade-in-0 duration-200">
                {pendingDashboardSkeleton}
              </div>
            ) : (
              <div
                className={`animate-in fade-in-0 duration-200 ${
                  isCalendar || isDashboardIndex || isBroadcastsViewportLocked
                    ? "flex min-h-0 flex-1 flex-col"
                    : ""
                }`}
              >
                <Outlet />
              </div>
            )}
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}

export default DashboardLayoutPage;
