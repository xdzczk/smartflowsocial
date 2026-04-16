import {
  Outlet,
  useLoaderData,
  useRouteLoaderData,
  Link,
  Form,
  useLocation,
  useNavigation,
} from "@remix-run/react";
import { X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

import Footer from "~/components/layout/DashboardFooter";
import Header from "~/components/layout/DashboardHeader";
import { ComposerSkeleton } from "~/components/skeletons/ComposerSkeleton";
import { DashboardSkeleton } from "~/components/skeletons/DashboardSkeleton";
import {
  AdminAnalyticsPageSkeleton,
  AdminOperationsPageSkeleton,
  AdminUsersPageSkeleton,
  BroadcastAudiencesPageSkeleton,
  BroadcastDetailPageSkeleton,
  BroadcastIndexPageSkeleton,
  BroadcastNewPageSkeleton,
  BroadcastReviewPageSkeleton,
  BulkPostsPageSkeleton,
  CalendarPageSkeleton,
  CalendarQueuePageSkeleton,
  ContestDetailPageSkeleton,
  ContestProofPageSkeleton,
  DraftsPageSkeleton,
  GiveawayBuilderPageSkeleton,
  GiveawayDetailPageSkeleton,
  GiveawayProofPageSkeleton,
  MediaSettingsPageSkeleton,
  PublishedPostsPageSkeleton,
  RecyclablesPageSkeleton,
  ScheduledPostsPageSkeleton,
  TemplatesPageSkeleton,
} from "~/components/skeletons/RoutePageSkeletons";
import { Skeleton } from "~/components/ui/skeleton";
import { EngagementFeedSkeleton } from "~/features/engagement/components/EngagementFeedSkeleton";
import {
  BillingAlertBanner,
  getUserPlanType,
  isSubscriptionPeriodExpired,
} from "~/features/payments";
import type { BillingContext } from "~/features/payments/types/subscription-billing.types";
import { CreateComposerShell } from "~/features/posts/composer/components/CreateComposerShell";
import { ReferredByBanner } from "~/features/referral/components/ReferredByBanner";
import { SettingsPageSkeleton } from "~/features/settings/components/SettingsPageSkeleton";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
import { useProductSessionTelemetry } from "~/lib/telemetry/product-session";
import type { loader as dashboardLoader } from "~/routes/dashboard";

const DESKTOP_SIDEBAR_OPEN_KEY = "dashboard-desktop-sidebar-open";
const DASHBOARD_INDEX_PATH = "/dashboard";
const FREE_PLAN_BANNER_DISMISSED_KEY =
  "smartflowsocial:dismissed-free-plan-banner";
const FREE_PLAN_BANNER_ANALYTICS_EVENT = "smartflow:free-plan-banner-analytics";
const subscribeNoop = () => () => {};
const getClientMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

type FreePlanBannerAnalyticsEventName =
  | "free_plan_banner_viewed"
  | "free_plan_banner_dismissed"
  | "free_plan_banner_cta_clicked";

function trackFreePlanBannerEvent(
  name: FreePlanBannerAnalyticsEventName
): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(FREE_PLAN_BANNER_ANALYTICS_EVENT, {
        detail: { name, at: Date.now() },
      })
    );
  } catch {
    // Ignore analytics errors.
  }
}

function ProfileBits({ nostrProfile }: { nostrProfile: unknown }): ReactNode {
  let name: string | undefined;
  let display_name: string | undefined;
  try {
    const p =
      typeof nostrProfile === "string"
        ? (JSON.parse(nostrProfile) as { name?: string; display_name?: string })
        : (nostrProfile as
            | { name?: string; display_name?: string }
            | undefined);
    name = p?.name;
    display_name = p?.display_name;
  } catch {
    /* ignore parse errors */
  }
  return <>{name ?? display_name ?? "Unknown User"}</>;
}

/** Dashboard index is the only route that should not scroll vertically on large screens; other dashboard pages need to scroll. */
function isDashboardIndexPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/";
  return normalized === DASHBOARD_INDEX_PATH;
}

/** Calendar route: lock viewport height on desktop so only the time grid scrolls. */
function isCalendarPath(pathname: string): boolean {
  return pathname.startsWith("/dashboard/calendar");
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
  const pendingRouteChanged =
    hasPendingTarget &&
    (pendingPathname !== location.pathname ||
      pendingSearch !== location.search);
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
  const statusInactive =
    currentSubscription != null && currentSubscription.status !== "ACTIVE";
  const periodExpired = isSubscriptionPeriodExpired(
    currentSubscription ?? null
  );
  const isSubscriptionExpired = statusInactive ? true : periodExpired;
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
  const isClientMounted = useSyncExternalStore(
    subscribeNoop,
    getClientMountedSnapshot,
    getServerMountedSnapshot
  );
  const [
    isFreePlanBannerDismissedLocally,
    setIsFreePlanBannerDismissedLocally,
  ] = useState(false);
  const isFreePlanBannerDismissed = useMemo(() => {
    if (!isClientMounted) return false;
    try {
      return sessionStorage.getItem(FREE_PLAN_BANNER_DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  }, [isClientMounted]);
  const hasTrackedFreePlanBannerView = useRef(false);

  const shouldShowFreePlanBanner =
    isClientMounted &&
    isFreePlan &&
    !showBillingAlert &&
    !isSubscriptionExpired &&
    !isFreePlanBannerDismissed &&
    !isFreePlanBannerDismissedLocally;

  useEffect(() => {
    if (!shouldShowFreePlanBanner || hasTrackedFreePlanBannerView.current) {
      return;
    }
    hasTrackedFreePlanBannerView.current = true;
    trackFreePlanBannerEvent("free_plan_banner_viewed");
  }, [shouldShowFreePlanBanner]);

  const handleDismissFreePlanBanner = () => {
    try {
      sessionStorage.setItem(FREE_PLAN_BANNER_DISMISSED_KEY, "1");
    } catch {
      // Ignore storage access errors.
    }
    setIsFreePlanBannerDismissedLocally(true);
    trackFreePlanBannerEvent("free_plan_banner_dismissed");
  };

  const handleFreePlanBannerCtaClick = () => {
    trackFreePlanBannerEvent("free_plan_banner_cta_clicked");
  };

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
        className={`bg-background mx-auto flex min-h-dvh w-full min-w-0 flex-col ${isCalendar ? "h-dvh overflow-x-visible" : ""} ${isDashboardIndex ? "lg:h-dvh lg:overflow-hidden" : ""} ${desktopSidebarOpen ? "lg:pl-64" : "lg:pl-16"}`}
        {...(mobileSidebarOpen ? { "data-mobile-sidebar-open": "" } : {})}
      >
        <Header
          desktopSidebarOpen={desktopSidebarOpen}
          onDesktopSidebarToggle={handleDesktopSidebarToggle}
          mobileSidebarOpen={mobileSidebarOpen}
          onMobileSidebarOpenChange={setMobileSidebarOpen}
          isOperatorAdmin={isOperatorAdmin}
        />

        {/* No overflow-x-hidden: it forces overflow-y to compute to auto and breaks position:sticky summary rails in dashboard builders. */}
        <main
          id="page-content"
          className={`flex min-h-0 max-w-full min-w-0 flex-1 flex-col pt-16 ${
            isCalendar ? "overflow-hidden" : ""
          }`}
        >
          {referredBy != null ? (
            <ReferredByBanner
              referrerNpub={referredBy.referrerNpub}
              referrerDisplayName={referredBy.referrerDisplayName ?? null}
            />
          ) : null}
          {pendingParentUsers.length > 0 ? (
            <div className="max-w-10xl mx-auto w-full px-4 pt-4 lg:px-8">
              {pendingParentUsers.map((p) => {
                const isThisSubmitting =
                  navigation.state === "submitting" &&
                  navAction === "respond_child_request" &&
                  navParentNpub === p.npub;
                return (
                  <div
                    key={p.npub}
                    className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100"
                  >
                    <div>
                      <p className="font-medium">
                        <ProfileBits nostrProfile={p.nostrProfile} /> wants to
                        manage your account
                      </p>
                      <p className="text-sm opacity-90">
                        Approve to link your account as a child, or reject this
                        request.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Form method="post">
                        <input
                          type="hidden"
                          name="_action"
                          value="respond_child_request"
                        />
                        <input type="hidden" name="parentNpub" value={p.npub} />
                        <input type="hidden" name="decision" value="reject" />
                        <button
                          className="bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex items-center rounded-md px-3 py-2 text-sm font-medium disabled:opacity-70"
                          type="submit"
                          disabled={isThisSubmitting}
                        >
                          {isThisSubmitting && navDecision === "reject"
                            ? "Rejecting..."
                            : "Reject"}
                        </button>
                      </Form>
                      <Form method="post">
                        <input
                          type="hidden"
                          name="_action"
                          value="respond_child_request"
                        />
                        <input type="hidden" name="parentNpub" value={p.npub} />
                        <input type="hidden" name="decision" value="accept" />
                        <button
                          className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring inline-flex items-center rounded-md px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-offset-0 focus:outline-none disabled:opacity-70"
                          type="submit"
                          disabled={isThisSubmitting}
                        >
                          {isThisSubmitting && navDecision === "accept"
                            ? "Approving..."
                            : "Approve"}
                        </button>
                      </Form>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {showBillingAlert ? (
            <BillingAlertBanner billingContext={billingContext} />
          ) : isSubscriptionExpired ? (
            <div className="max-w-10xl mx-auto w-full px-4 pt-4 lg:px-8">
              <div className="border-border bg-muted text-muted-foreground mb-4 flex items-start justify-between gap-3 rounded-lg border p-4">
                <div>
                  <p className="font-medium">Your subscription has expired</p>
                  <p className="text-sm opacity-90">
                    You’re on the Free plan now. Resubscribe to restore your
                    previous plan benefits.
                  </p>
                </div>
                <Link
                  prefetch="intent"
                  to="/plans"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring inline-flex items-center rounded-md px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-offset-0 focus:outline-none"
                >
                  View plans
                </Link>
              </div>
            </div>
          ) : shouldShowFreePlanBanner ? (
            <div className="max-w-10xl mx-auto w-full px-4 pt-4 lg:px-8">
              <div className="border-border-subtle bg-card/80 text-muted-foreground mb-4 rounded-xl border px-4 py-3.5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground text-sm font-semibold tracking-tight">
                      You’re on the Free plan
                    </p>
                    <p className="mt-1 text-sm leading-5">
                      You’re on Free - enough to test the core workflow. Upgrade
                      later for more accounts, higher limits, and stronger
                      publishing infrastructure.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 self-start md:ml-4 md:shrink-0">
                    <Link
                      prefetch="intent"
                      to="/plans"
                      onClick={handleFreePlanBannerCtaClick}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring inline-flex h-9 shrink-0 items-center rounded-md px-3 text-sm font-medium focus:ring-2 focus:ring-offset-0 focus:outline-none"
                    >
                      View plans
                    </Link>
                    <button
                      type="button"
                      aria-label="Dismiss free plan banner"
                      onClick={handleDismissFreePlanBanner}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-1 focus-visible:outline-none"
                    >
                      <X
                        className={INLINE_ICON_SIZE_CLASS}
                        strokeWidth={INLINE_ICON_STROKE}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div
            className={`flex w-full min-w-0 flex-1 flex-col ${isCalendar ? "pt-0 pb-0" : isDashboardIndex ? "pt-4.5 pb-8 md:pb-24" : "pt-4.5 pb-24"} ${isDashboardIndex ? "lg:min-h-0 lg:overflow-y-auto" : isCalendar ? "min-h-0 min-w-0" : "max-w-10xl mx-auto px-4 lg:px-8"}`}
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
                  isCalendar ? "flex min-h-0 flex-1 flex-col" : ""
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
