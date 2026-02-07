import { Link, useLocation } from "@remix-run/react";
import { Lock } from "lucide-react";
import { useCallback, useState, useEffect } from "react";
import {
  HiOutlineHome,
  HiOutlineCalendarDays,
  HiOutlineDocumentText,
  HiOutlineCloudArrowUp,
  HiOutlineSquares2X2,
  HiOutlineDocumentDuplicate,
  HiOutlineCalendar,
  HiOutlineClock,
  HiOutlineGift,
  HiOutlineFire,
  HiOutlineCog6Tooth,
  HiOutlineBars3,
  HiOutlineXMark,
} from "react-icons/hi2";

import { ExpandableNavigationSection } from "~/components/layout/ExpandableNavigationSection";
import { GlobalSearchBar } from "~/components/layout/GlobalSearchBar";
import UserMenu from "~/components/layout/UserMenu";
import { Button } from "~/components/ui/button";
import { Logo } from "~/components/ui/Logo";
import { ThemeToggle } from "~/components/ui/ThemeToggle";
import UpgradePrompt from "~/features/payments/components/UpgradePrompt";
import {
  useFeatureAccess,
  useSubscription,
  getMinimumPlanForFeature,
  type FeatureName,
} from "~/features/payments/types";

// Nav config for expandable sections (reduces inline complexity in Header)
const CREATE_SECTION_ITEMS = [
  {
    to: "/dashboard/newpost",
    feature: "newPost" as const,
    icon: <HiOutlineCloudArrowUp className="inline-block size-5" />,
    label: "New Post",
  },
  {
    to: "/dashboard/newlongformpost",
    feature: "longformPosts" as const,
    icon: <HiOutlineDocumentText className="inline-block size-5" />,
    label: "New Long-form",
  },
  {
    to: "/dashboard/bulkposts",
    feature: "bulkScheduling" as const,
    icon: <HiOutlineSquares2X2 className="inline-block size-5" />,
    label: "Bulk Posts",
  },
  {
    to: "/dashboard/drafts",
    feature: "drafts" as const,
    icon: <HiOutlineDocumentText className="inline-block size-5" />,
    label: "Drafts",
  },
  {
    to: "/dashboard/templates",
    feature: "templates" as const,
    icon: <HiOutlineDocumentDuplicate className="inline-block size-5" />,
    label: "Templates",
  },
];

const ENGAGEMENT_SECTION_ITEMS = [
  {
    to: "/dashboard/engagement/feed",
    feature: "engagement_feed" as const,
    icon: <HiOutlineFire className="inline-block size-5" />,
    label: "Engagement Feed",
  },
  {
    to: "/dashboard/giveaway?days=7",
    feature: "giveaways" as const,
    icon: <HiOutlineGift className="inline-block size-5" />,
    label: "Giveaway",
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
  const hasAccessByPlan = useFeatureAccess(feature);
  const subscription = useSubscription();
  const hasAnySubscription = !!subscription?.currentSubscription;

  const isDashboardRoot = to === "/dashboard";
  // Effective access: dashboard root is always accessible; all other dashboard child
  // routes require the user to have any subscription AND the plan to include the feature
  const hasAccess = isDashboardRoot
    ? true
    : hasAnySubscription && hasAccessByPlan;

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

  const linkClass = `group flex items-center gap-2 rounded-lg border border-transparent px-2.5 text-sm font-medium relative focus:outline-none focus:ring-2 focus:ring-ring ${
    collapsed ? "justify-center px-0 py-2" : ""
  } ${
    isActive
      ? "bg-muted text-foreground border-border dark:bg-muted dark:text-primary dark:border-border"
      : hasAccess
        ? "text-muted-foreground hover:bg-muted hover:text-foreground active:border-border"
        : "text-muted-foreground/50 cursor-not-allowed opacity-60"
  }`;

  const title = !hasAccess
    ? `Requires ${getMinimumPlanForFeature(feature)} plan`
    : (children as string);

  return (
    <Link
      prefetch="intent"
      to={hasAccess ? to : "#"}
      className={linkClass}
      onClick={handleClick}
      title={title}
    >
      <span
        className={`flex flex-none items-center ${isActive ? "text-foreground dark:text-primary" : "text-muted-foreground"}`}
      >
        {icon}
      </span>
      {!collapsed ? (
        <>
          <span className="grow py-2">{children}</span>
          {!hasAccess ? (
            <Lock className="h-4 w-4 flex-shrink-0 text-amber-500" />
          ) : null}
        </>
      ) : null}
    </Link>
  );
}

interface SidebarNavContentProps {
  pathname: string;
  isDesktopExpanded: boolean;
  onUpgradeClick: (feature: FeatureName, featureName: string) => void;
  onMobileNavActiveClick: (() => void) | undefined;
}

function SidebarNavContent({
  pathname,
  isDesktopExpanded,
  onUpgradeClick,
  onMobileNavActiveClick,
}: SidebarNavContentProps) {
  const collapsed = !isDesktopExpanded;
  return (
    <nav className="space-y-1">
      <NavigationItem
        to="/dashboard"
        feature="dashboard"
        isActive={pathname === "/dashboard"}
        onUpgradeClick={onUpgradeClick}
        onActiveClick={onMobileNavActiveClick}
        icon={<HiOutlineHome className="inline-block size-5 shrink-0" />}
        collapsed={collapsed}
      >
        Dashboard
      </NavigationItem>
      <ExpandableNavigationSection
        title="Create"
        icon={<HiOutlineCloudArrowUp className="inline-block size-5" />}
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
          <HiOutlineCalendarDays className="inline-block size-5 shrink-0" />
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
        icon={<HiOutlineCalendar className="inline-block size-5 shrink-0" />}
        collapsed={collapsed}
      >
        Scheduled
      </NavigationItem>
      <NavigationItem
        to="/dashboard/posted"
        feature="posted"
        isActive={pathname.startsWith("/dashboard/posted")}
        onUpgradeClick={onUpgradeClick}
        onActiveClick={onMobileNavActiveClick}
        icon={<HiOutlineClock className="inline-block size-5 shrink-0" />}
        collapsed={collapsed}
      >
        Posted
      </NavigationItem>
      <ExpandableNavigationSection
        title="Engagement"
        icon={<HiOutlineFire className="inline-block size-5" />}
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
      className={`bg-card lg:border-border flex h-16 w-full flex-none items-center justify-between border-b border-transparent px-4 transition-[padding] duration-300 lg:justify-center ${
        isDesktopExpanded ? "lg:px-4" : "lg:px-0"
      }`}
    >
      <Link
        prefetch="intent"
        to="/dashboard"
        className={`group text-foreground hover:text-primary focus:ring-ring inline-flex items-center rounded-lg transition-colors focus:ring-2 focus:outline-none ${
          isDesktopExpanded ? "gap-2" : "w-full justify-center"
        }`}
        title="SmartFlow Social"
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
          alt="SmartFlow Social"
          className={`h-9 w-auto lg:h-10 ${
            isDesktopExpanded ? "" : "lg:h-8 lg:w-8 lg:object-contain"
          }`}
        />
      </Link>
      <div className="lg:hidden">
        <Button
          onClick={onCloseMobile}
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-lg shadow-none"
        >
          <HiOutlineXMark className="inline-block size-5" />
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
      className={`bg-background border-border fixed top-0 right-0 left-0 z-30 flex h-16 flex-none items-center border-b transition-[padding] duration-300 ${isDesktopExpanded ? "lg:pl-64" : "lg:pl-16"}`}
    >
      <div className="max-w-10xl mx-auto flex w-full justify-between px-3 sm:px-4 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="hidden lg:block">
            <Button
              onClick={onDesktopToggle}
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg shadow-none"
            >
              <HiOutlineBars3 className="inline-block size-5" />
            </Button>
          </div>
          <div className="lg:hidden">
            <Button
              onClick={onMobileToggle}
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg shadow-none"
            >
              <HiOutlineBars3 className="inline-block size-5" />
            </Button>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-2 sm:px-3 lg:px-6">
          <GlobalSearchBar className="w-full min-w-0" />
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
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
}

export default function Header({
  desktopSidebarOpen = true,
  onDesktopSidebarToggle,
  mobileSidebarOpen: controlledMobileOpen,
  onMobileSidebarOpenChange,
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
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 1023px)").matches
      : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const fn = () => setIsMobile(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

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

  const sidebarPadding = isDesktopExpanded ? "p-4" : "p-2 lg:px-2 lg:py-3";

  return (
    <>
      <nav
        id="page-sidebar"
        aria-label="Main Sidebar Navigation"
        className={`border-border bg-card text-foreground fixed top-0 bottom-0 left-0 z-50 flex h-full w-full flex-col border-r transition-[width,transform] duration-300 ease-out lg:translate-x-0 ${
          isDesktopExpanded ? "lg:w-64" : "lg:w-16"
        } ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <SidebarHeader
          isDesktopExpanded={isDesktopExpanded}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />
        <div className="overflow-x-hidden overflow-y-auto">
          <div
            className={`w-full transition-[padding] duration-300 ${sidebarPadding}`}
          >
            <SidebarNavContent
              pathname={location.pathname}
              isDesktopExpanded={isDesktopExpanded}
              onUpgradeClick={handleUpgradeClick}
              onMobileNavActiveClick={onMobileNavActiveClick}
            />
          </div>
        </div>
        <div
          className={`mt-auto transition-[padding] duration-300 ${sidebarPadding}`}
        >
          <NavigationItem
            to="/dashboard/settings"
            feature="settings"
            isActive={location.pathname === "/dashboard/settings"}
            onUpgradeClick={handleUpgradeClick}
            onActiveClick={onMobileNavActiveClick}
            icon={
              <HiOutlineCog6Tooth className="inline-block size-5 shrink-0" />
            }
            collapsed={!isDesktopExpanded}
          >
            Settings
          </NavigationItem>
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
