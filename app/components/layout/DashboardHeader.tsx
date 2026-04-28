import {
  Link,
  useLocation,
  useNavigate,
  useRouteLoaderData,
} from "@remix-run/react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  FilePenLine,
  Flame,
  Gift,
  Home,
  LayoutGrid,
  Lock,
  Megaphone,
  Menu,
  MessageSquare,
  Plus,
  Rss,
  Settings,
  Shield,
  Trophy,
  X,
} from "lucide-react";
import { useCallback, useState, useEffect } from "react";
import type { MouseEvent } from "react";

import {
  DASHBOARD_SIDEBAR_NAV_LINK_ACTIVE,
  DASHBOARD_SIDEBAR_NAV_LINK_INACTIVE_ACCESSIBLE,
} from "~/components/layout/dashboard-nav-link-classes";
import { ExpandableNavigationSection } from "~/components/layout/ExpandableNavigationSection";
import { GlobalSearchBar } from "~/components/layout/GlobalSearchBar";
import { PlanUsageSidebar } from "~/components/layout/PlanUsageSidebar";
import { ProductFeedbackSidebar } from "~/components/layout/ProductFeedbackSidebar";
import UserMenu from "~/components/layout/UserMenu";
import { InstallPromptSidebar } from "~/components/pwa/InstallPrompt";
import { Button } from "~/components/ui/button";
import { Logo } from "~/components/ui/Logo";
import { ThemeToggle } from "~/components/ui/ThemeToggle";
import UpgradePrompt from "~/features/payments/components/UpgradePrompt";
import { useSubscription, type FeatureName } from "~/features/payments/types";
import { BRAND_NAME } from "~/lib/brand";
import { useInstallPrompt } from "~/lib/hooks/useInstallPrompt";
import { useIsMobile } from "~/lib/hooks/useIsMobile";

// Sidebar/nav icon tuning for Kanit: 18px, stroke 2.25 so icons feel co-equal with text (not decorative)
const NAV_ICON_SIZE_CLASS = "inline-block size-[18px] shrink-0";
const NAV_ICON_STROKE = 2.25;

const DASHBOARD_ROOT_PATH = "/dashboard";

// Nav config for expandable sections (reduces inline complexity in Header)
// Semantic rule: Create = Plus. Composer = MessageSquare (single entry).
const CREATE_SECTION_ITEMS = [
  {
    to: "/dashboard/compose",
    feature: "newPost" as const,
    icon: (
      <MessageSquare
        className={NAV_ICON_SIZE_CLASS}
        strokeWidth={NAV_ICON_STROKE}
      />
    ),
    label: "Composer",
  },
  {
    to: "/dashboard/bulkposts",
    feature: "bulkScheduling" as const,
    icon: (
      <LayoutGrid
        className={NAV_ICON_SIZE_CLASS}
        strokeWidth={NAV_ICON_STROKE}
      />
    ),
    label: "Bulk Posts",
  },
  {
    to: "/dashboard/drafts",
    feature: "drafts" as const,
    icon: (
      <FilePenLine
        className={NAV_ICON_SIZE_CLASS}
        strokeWidth={NAV_ICON_STROKE}
      />
    ),
    label: "Drafts",
  },
  {
    to: "/dashboard/templates",
    feature: "templates" as const,
    icon: (
      <Copy className={NAV_ICON_SIZE_CLASS} strokeWidth={NAV_ICON_STROKE} />
    ),
    label: "Templates",
  },
];

// Engagement = Flame (domain). Engagement Feed = Rss (feed, not duplicate of parent).
const ENGAGEMENT_SECTION_ITEMS = [
  {
    to: "/dashboard/engagement/feed",
    feature: "engagement_feed" as const,
    icon: <Rss className={NAV_ICON_SIZE_CLASS} strokeWidth={NAV_ICON_STROKE} />,
    label: "Engagement Feed",
  },
  {
    to: "/dashboard/giveaway",
    feature: "giveaways" as const,
    icon: (
      <Gift className={NAV_ICON_SIZE_CLASS} strokeWidth={NAV_ICON_STROKE} />
    ),
    label: "Giveaways",
  },
  {
    to: "/dashboard/contests",
    feature: "contests" as const,
    icon: (
      <Trophy className={NAV_ICON_SIZE_CLASS} strokeWidth={NAV_ICON_STROKE} />
    ),
    label: "Contests",
  },
  {
    to: "/dashboard/broadcasts",
    feature: "broadcasts" as const,
    icon: (
      <Megaphone
        className={NAV_ICON_SIZE_CLASS}
        strokeWidth={NAV_ICON_STROKE}
      />
    ),
    label: "Broadcasts",
  },
];

// Navigation item component with lock functionality
interface NavigationItemProps {
  to: string;
  feature: FeatureName;
  icon: React.ReactNode;
  children: React.ReactNode;
  isActive?: boolean;
  onUpgradeClick: (feature: FeatureName, featureName: string) => void;
  /** When provided and link is active (current page), click closes sidebar instead of navigating (e.g. mobile) */
  onActiveClick?: () => void;
  collapsed?: boolean;
}

function NavigationItem({
  to,
  feature,
  icon,
  children,
  isActive,
  onUpgradeClick,
  onActiveClick,
  collapsed = false,
}: NavigationItemProps) {
  const subscription = useSubscription();
  const hasAnySubscription = !!subscription?.currentSubscription;

  const isDashboardRoot = to === DASHBOARD_ROOT_PATH;
  // Browse-all: any child route is navigable once the user has a subscription (limits are action-level).
  const hasAccess = isDashboardRoot ? true : hasAnySubscription;

  const handleClick = (e: React.MouseEvent) => {
    if (!hasAccess) {
      e.preventDefault();
      // Show upgrade prompt
      onUpgradeClick(feature, children as string);
      return;
    }
    if (isActive && onActiveClick) {
      e.preventDefault();
      onActiveClick();
    }
  };

  const linkClass = `focus-ring group cluster tap-target rounded-lg px-2.5 text-sm relative max-lg:min-h-11 max-lg:items-center ${
    collapsed ? "justify-center px-0 py-2" : ""
  } ${
    isActive
      ? DASHBOARD_SIDEBAR_NAV_LINK_ACTIVE
      : hasAccess
        ? DASHBOARD_SIDEBAR_NAV_LINK_INACTIVE_ACCESSIBLE
        : "text-text-secondary/50 cursor-not-allowed border-transparent font-medium opacity-60"
  }`;

  const title = !hasAccess ? "Subscription required" : (children as string);

  // Inactive icons use slightly higher contrast than inactive text; match link hover so icon and text react together
  const iconSpanClass = isActive
    ? "text-surface-selected-foreground"
    : hasAccess
      ? "text-text/70 group-hover:text-text"
      : "text-text-secondary";

  return (
    <Link
      prefetch="intent"
      to={hasAccess ? to : "#"}
      className={linkClass}
      onClick={handleClick}
      title={title}
    >
      <span className={`flex flex-none items-center ${iconSpanClass}`}>
        {icon}
      </span>
      {!collapsed ? (
        <>
          <span className="grow py-2 max-lg:py-1.5">{children}</span>
          {!hasAccess ? (
            <Lock
              className="text-warning h-4 w-4 flex-shrink-0"
              strokeWidth={NAV_ICON_STROKE}
            />
          ) : null}
        </>
      ) : null}
    </Link>
  );
}

/** Operator-only link; bypasses plan/feature gating (see ADMIN_NPUBS). */
function OperatorAdminNavItem({
  pathname,
  collapsed,
  onMobileNavActiveClick,
}: {
  pathname: string;
  collapsed: boolean;
  onMobileNavActiveClick: (() => void) | undefined;
}) {
  const navigate = useNavigate();
  const isActive = pathname.startsWith("/dashboard/admin");
  const linkClass = `focus-ring group cluster tap-target rounded-lg px-2.5 text-sm relative max-lg:min-h-11 max-lg:items-center ${
    collapsed ? "justify-center px-0 py-2" : ""
  } ${
    isActive
      ? DASHBOARD_SIDEBAR_NAV_LINK_ACTIVE
      : DASHBOARD_SIDEBAR_NAV_LINK_INACTIVE_ACCESSIBLE
  }`;
  const iconSpanClass = isActive
    ? "text-surface-selected-foreground"
    : "text-text/70 group-hover:text-text";

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    if (isActive && onMobileNavActiveClick) {
      e.preventDefault();
      onMobileNavActiveClick();
      return;
    }
    // Avoid Remix <Link prefetch="intent"> here: prefetching /dashboard/admin can look like a
    // full reload and may interact badly with loader responses; client navigate is stable.
    e.preventDefault();
    navigate("/dashboard/admin");
    onMobileNavActiveClick?.();
  };

  return (
    <a
      href="/dashboard/admin"
      className={linkClass}
      title="Operator admin"
      onClick={handleClick}
    >
      <span className={`flex flex-none items-center ${iconSpanClass}`}>
        <Shield className={NAV_ICON_SIZE_CLASS} strokeWidth={NAV_ICON_STROKE} />
      </span>
      {!collapsed ? (
        <span className="grow py-2 max-lg:py-1.5">Admin</span>
      ) : null}
    </a>
  );
}

interface SidebarNavContentProps {
  pathname: string;
  isDesktopExpanded: boolean;
  onUpgradeClick: (feature: FeatureName, featureName: string) => void;
  onMobileNavActiveClick: (() => void) | undefined;
  isFirstRunDashboard: boolean;
}

function SidebarNavContent({
  pathname,
  isDesktopExpanded,
  onUpgradeClick,
  onMobileNavActiveClick,
  isFirstRunDashboard,
}: SidebarNavContentProps) {
  const collapsed = !isDesktopExpanded;
  return (
    <nav className="space-y-1 max-lg:space-y-0.5">
      <NavigationItem
        to={DASHBOARD_ROOT_PATH}
        feature="dashboard"
        isActive={pathname === DASHBOARD_ROOT_PATH}
        onUpgradeClick={onUpgradeClick}
        onActiveClick={onMobileNavActiveClick}
        icon={
          <Home className={NAV_ICON_SIZE_CLASS} strokeWidth={NAV_ICON_STROKE} />
        }
        collapsed={collapsed}
      >
        Dashboard
      </NavigationItem>
      <ExpandableNavigationSection
        title="Create"
        icon={
          <Plus className={NAV_ICON_SIZE_CLASS} strokeWidth={NAV_ICON_STROKE} />
        }
        showSubtleHint={isFirstRunDashboard}
        collapsed={collapsed}
        items={CREATE_SECTION_ITEMS}
        onUpgradeClick={onUpgradeClick}
        onActiveClick={onMobileNavActiveClick}
      />
      <NavigationItem
        to="/dashboard/calendar"
        feature="calendar"
        isActive={pathname.startsWith("/dashboard/calendar")}
        onUpgradeClick={onUpgradeClick}
        onActiveClick={onMobileNavActiveClick}
        icon={
          <CalendarDays
            className={NAV_ICON_SIZE_CLASS}
            strokeWidth={NAV_ICON_STROKE}
          />
        }
        collapsed={collapsed}
      >
        Calendar
      </NavigationItem>
      <NavigationItem
        to="/dashboard/scheduled"
        feature="scheduled"
        isActive={pathname.startsWith("/dashboard/scheduled")}
        onUpgradeClick={onUpgradeClick}
        onActiveClick={onMobileNavActiveClick}
        icon={
          <Clock
            className={NAV_ICON_SIZE_CLASS}
            strokeWidth={NAV_ICON_STROKE}
          />
        }
        collapsed={collapsed}
      >
        Scheduled
      </NavigationItem>
      <NavigationItem
        to="/dashboard/published"
        feature="published"
        isActive={pathname.startsWith("/dashboard/published")}
        onUpgradeClick={onUpgradeClick}
        onActiveClick={onMobileNavActiveClick}
        icon={
          <Check
            className={NAV_ICON_SIZE_CLASS}
            strokeWidth={NAV_ICON_STROKE}
          />
        }
        collapsed={collapsed}
      >
        Published
      </NavigationItem>
      <ExpandableNavigationSection
        title="Engagement"
        icon={
          <Flame
            className={NAV_ICON_SIZE_CLASS}
            strokeWidth={NAV_ICON_STROKE}
          />
        }
        collapsed={collapsed}
        items={ENGAGEMENT_SECTION_ITEMS}
        onUpgradeClick={onUpgradeClick}
        onActiveClick={onMobileNavActiveClick}
      />
    </nav>
  );
}

interface SidebarHeaderProps {
  isDesktopExpanded: boolean;
  onCloseMobile: () => void;
}

function SidebarHeader({
  isDesktopExpanded,
  onCloseMobile,
}: SidebarHeaderProps) {
  return (
    <div
      className={`flex min-h-[var(--header-h)] w-full flex-none items-center justify-between border-b border-transparent px-4 py-3.5 transition-[padding] duration-300 max-lg:py-3 lg:justify-center lg:py-4 ${
        isDesktopExpanded ? "lg:px-4" : "lg:px-0"
      }`}
    >
      <Link
        prefetch="intent"
        to={DASHBOARD_ROOT_PATH}
        className={`focus-ring group text-text hover:text-link-hover motion-fast inline-flex items-center rounded-lg ${
          isDesktopExpanded ? "gap-2" : "w-full justify-center"
        }`}
        title={BRAND_NAME}
      >
        <Logo
          lightSrc={
            isDesktopExpanded
              ? "/logos/Logo-Full-LightMode.svg"
              : "/Logo-NoText.svg"
          }
          darkSrc={
            isDesktopExpanded
              ? "/logos/Logo-Full-DarkMode.svg"
              : "/Logo-NoText.svg"
          }
          alt={BRAND_NAME}
          className={
            isDesktopExpanded
              ? "h-9 w-auto lg:h-9"
              : "h-9 w-auto lg:h-8 lg:w-8 lg:object-contain"
          }
        />
      </Link>
      <div className="lg:hidden">
        <Button
          onClick={onCloseMobile}
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-lg shadow-none"
        >
          <X className={NAV_ICON_SIZE_CLASS} strokeWidth={NAV_ICON_STROKE} />
        </Button>
      </div>
    </div>
  );
}

interface PageHeaderBarProps {
  isDesktopExpanded: boolean;
  onDesktopToggle: () => void;
  onMobileToggle: () => void;
}

function PageHeaderBar({
  isDesktopExpanded,
  onDesktopToggle,
  onMobileToggle,
}: PageHeaderBarProps) {
  return (
    <header
      id="page-header"
      className={`dashboard-shell-chrome h-header pt-safe-top fixed top-0 right-0 left-0 z-30 flex flex-none items-center transition-[padding] duration-300 ${isDesktopExpanded ? "lg:pl-64" : "lg:pl-12"}`}
    >
      <div className="safe-x-4 max-w-page mx-auto flex w-full min-w-0 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex shrink-0 items-center">
          <div className="hidden lg:block">
            <Button
              type="button"
              onClick={onDesktopToggle}
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg shadow-none"
              aria-label={
                isDesktopExpanded ? "Collapse sidebar" : "Expand sidebar"
              }
            >
              {isDesktopExpanded ? (
                <ChevronLeft
                  className={NAV_ICON_SIZE_CLASS}
                  strokeWidth={NAV_ICON_STROKE}
                  aria-hidden
                />
              ) : (
                <ChevronRight
                  className={NAV_ICON_SIZE_CLASS}
                  strokeWidth={NAV_ICON_STROKE}
                  aria-hidden
                />
              )}
            </Button>
          </div>
          <div className="lg:hidden">
            <Button
              type="button"
              onClick={onMobileToggle}
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg shadow-none"
              aria-label="Open navigation"
            >
              <Menu
                className={NAV_ICON_SIZE_CLASS}
                strokeWidth={NAV_ICON_STROKE}
                aria-hidden
              />
            </Button>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center px-2.5 sm:px-4 lg:px-6">
          <GlobalSearchBar className="w-full max-w-xl min-w-0" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

interface HeaderProps {
  desktopSidebarOpen?: boolean;
  onDesktopSidebarToggle?: () => void;
  /** When provided, mobile sidebar is controlled by parent (e.g. to disable pointer-events on page content) */
  mobileSidebarOpen?: boolean;
  onMobileSidebarOpenChange?: (open: boolean) => void;
  /** True when signed-in npub is listed in ADMIN_NPUBS */
  isOperatorAdmin?: boolean;
}

export default function Header({
  desktopSidebarOpen = true,
  onDesktopSidebarToggle,
  mobileSidebarOpen: controlledMobileOpen,
  onMobileSidebarOpenChange,
  isOperatorAdmin = false,
}: HeaderProps) {
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);
  const mobileSidebarOpen =
    onMobileSidebarOpenChange !== undefined &&
    controlledMobileOpen !== undefined
      ? controlledMobileOpen
      : internalMobileOpen;
  const setMobileSidebarOpen = useCallback(
    (open: boolean) => {
      if (onMobileSidebarOpenChange) onMobileSidebarOpenChange(open);
      else setInternalMobileOpen(open);
    },
    [onMobileSidebarOpenChange]
  );

  const [desktopOpen, setDesktopOpen] = useState(desktopSidebarOpen);

  const isDesktopExpanded =
    onDesktopSidebarToggle !== undefined ? desktopSidebarOpen : desktopOpen;
  const handleDesktopSidebarToggle = () => {
    if (onDesktopSidebarToggle) onDesktopSidebarToggle();
    else setDesktopOpen((prev) => !prev);
  };

  const [upgradePrompt, setUpgradePrompt] = useState<{
    isOpen: boolean;
    feature: FeatureName | null;
    featureName: string;
  }>({ isOpen: false, feature: null, featureName: "" });
  const location = useLocation();
  const dashboardLayoutData = useRouteLoaderData("routes/dashboard") as
    | { isFirstRunDashboard?: boolean }
    | undefined;
  const isFirstRunDashboard = dashboardLayoutData?.isFirstRunDashboard === true;

  const install = useInstallPrompt();
  const [installIosInstructionsOpen, setInstallIosInstructionsOpen] =
    useState(false);
  const handlePwaChromiumInstall = useCallback(() => {
    void (async () => {
      const accepted = await install.triggerPrompt();
      if (!accepted) {
        install.dismiss();
      }
    })();
  }, [install]);

  useEffect(() => {
    if (!install.shouldRender) {
      queueMicrotask(() => setInstallIosInstructionsOpen(false));
    }
  }, [install.shouldRender]);

  // Shared SSR-safe hook; always returns `false` on the server and the first
  // client render, then flips via useEffect. This avoids React hydration
  // error #418 which previously fired when the server rendered desktop
  // markup and the client hydrated with mobile markup.
  const isMobile = useIsMobile(1023);

  useEffect(() => {
    const timeoutId = setTimeout(() => setMobileSidebarOpen(false), 0);
    return () => clearTimeout(timeoutId);
  }, [location.pathname, setMobileSidebarOpen]);

  const handleUpgradeClick = (feature: FeatureName, featureName: string) => {
    setUpgradePrompt({ isOpen: true, feature, featureName });
  };
  const closeUpgradePrompt = () => {
    setUpgradePrompt({ isOpen: false, feature: null, featureName: "" });
  };
  const onMobileNavActiveClick = isMobile
    ? () => setMobileSidebarOpen(false)
    : undefined;

  const sidebarNavPad = isDesktopExpanded
    ? "px-4 pt-4 pb-2"
    : "px-2 pt-2 pb-2 lg:px-2 lg:pt-4";
  const sidebarBottomPad = isDesktopExpanded
    ? "px-4 pb-4"
    : "px-2 pb-4 lg:px-2";

  return (
    <>
      <nav
        id="page-sidebar"
        aria-label="Main Sidebar Navigation"
        className={`dashboard-shell-chrome text-text pt-safe-top safe-pb-2 fixed top-0 bottom-0 left-0 z-50 flex h-full w-full flex-col transition-[width,transform] duration-300 ease-out lg:translate-x-0 ${
          isDesktopExpanded ? "lg:w-64" : "lg:w-12"
        } ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <SidebarHeader
          isDesktopExpanded={isDesktopExpanded}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden">
          <div
            className={`min-h-0 shrink grow-0 overflow-y-auto overscroll-y-contain transition-[padding] duration-300 ${sidebarNavPad}`}
          >
            <div className="flex flex-col gap-2">
              <SidebarNavContent
                pathname={location.pathname}
                isDesktopExpanded={isDesktopExpanded}
                onUpgradeClick={handleUpgradeClick}
                onMobileNavActiveClick={onMobileNavActiveClick}
                isFirstRunDashboard={isFirstRunDashboard}
              />
              {isOperatorAdmin ? (
                <OperatorAdminNavItem
                  pathname={location.pathname}
                  collapsed={!isDesktopExpanded}
                  onMobileNavActiveClick={onMobileNavActiveClick}
                />
              ) : null}
            </div>
          </div>
          <div className="min-h-0 shrink-0 grow basis-0" aria-hidden />
          <div
            className={`flex shrink-0 flex-col pt-8 transition-[padding] duration-300 ${sidebarBottomPad}`}
          >
            <PlanUsageSidebar
              isDesktopExpanded={isDesktopExpanded}
              onMobileNavActiveClick={onMobileNavActiveClick}
            />
            {install.shouldRender ? (
              <div className="mt-5">
                <InstallPromptSidebar
                  isDesktopExpanded={isDesktopExpanded}
                  canPrompt={install.canPrompt}
                  isIosSafariInstallable={install.isIosSafariInstallable}
                  onChromiumInstall={handlePwaChromiumInstall}
                  dismiss={install.dismiss}
                  iosInstructionsOpen={installIosInstructionsOpen}
                  setIosInstructionsOpen={setInstallIosInstructionsOpen}
                />
              </div>
            ) : null}
            <div className="mt-3 flex flex-col gap-1">
              <NavigationItem
                to="/dashboard/settings"
                feature="settings"
                isActive={location.pathname === "/dashboard/settings"}
                onUpgradeClick={handleUpgradeClick}
                onActiveClick={onMobileNavActiveClick}
                icon={
                  <Settings
                    className={NAV_ICON_SIZE_CLASS}
                    strokeWidth={NAV_ICON_STROKE}
                  />
                }
                collapsed={!isDesktopExpanded}
              >
                Settings
              </NavigationItem>
              <ProductFeedbackSidebar
                collapsed={!isDesktopExpanded}
                onOpenMobileSidebarClose={onMobileNavActiveClick}
              />
            </div>
          </div>
        </div>
      </nav>
      <PageHeaderBar
        isDesktopExpanded={isDesktopExpanded}
        onDesktopToggle={handleDesktopSidebarToggle}
        onMobileToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
      />
      {upgradePrompt.feature ? (
        <UpgradePrompt
          isOpen={upgradePrompt.isOpen}
          onClose={closeUpgradePrompt}
          feature={upgradePrompt.feature}
          featureName={upgradePrompt.featureName}
        />
      ) : null}
    </>
  );
}
