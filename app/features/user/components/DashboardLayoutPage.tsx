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
import {
  BillingAlertBanner,
  getUserPlanType,
  isSubscriptionPeriodExpired,
} from "~/features/payments";
import type { BillingContext } from "~/features/payments/types/subscription-billing.types";
import { ReferredByBanner } from "~/features/referral/components/ReferredByBanner";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
import { useProductSessionTelemetry } from "~/lib/telemetry/product-session";
import type { loader as dashboardLoader } from "~/routes/dashboard";

const DESKTOP_SIDEBAR_OPEN_KEY = "dashboard-desktop-sidebar-open";
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
  return normalized === "/dashboard";
}

/** Calendar route: lock viewport height on desktop so only the time grid scrolls. */
function isCalendarPath(pathname: string): boolean {
  return pathname.startsWith("/dashboard/calendar");
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
  const navAction =
    (navigation.formData?.get("_action") as string) || undefined;
  const navParentNpub =
    (navigation.formData?.get("parentNpub") as string) || undefined;
  const navDecision =
    (navigation.formData?.get("decision") as string) || undefined;

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
        className={`bg-background mx-auto flex min-h-dvh w-full min-w-0 flex-col ${isCalendar ? "h-dvh overflow-x-visible overflow-y-hidden" : ""} ${isDashboardIndex ? "lg:h-dvh lg:overflow-hidden" : ""} ${desktopSidebarOpen ? "lg:pl-64" : "lg:pl-16"}`}
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
          className="flex min-h-0 max-w-full min-w-0 flex-1 flex-col pt-16"
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
            className={`flex w-full min-w-0 flex-1 flex-col ${isCalendar ? "pt-0 pb-0" : isDashboardIndex ? "pt-4.5 pb-8 md:pb-24" : "pt-4.5 pb-24"} ${isDashboardIndex ? "lg:min-h-0 lg:overflow-y-auto" : isCalendar ? "min-h-0 min-w-0 lg:overflow-hidden" : "max-w-10xl mx-auto px-4 lg:px-8"}`}
          >
            <Outlet />
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}

export default DashboardLayoutPage;
