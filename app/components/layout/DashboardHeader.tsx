import { Link, useLocation } from "@remix-run/react";
import { Lock } from "lucide-react";
import { useState, useEffect } from "react";
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

// Navigation item component with lock functionality
interface NavigationItemProps {
  to: string;
  feature: FeatureName;
  icon: React.ReactNode;
  children: React.ReactNode;
  isActive?: boolean;
  onUpgradeClick: (feature: FeatureName, featureName: string) => void;
  collapsed?: boolean;
}

function NavigationItem({
  to,
  feature,
  icon,
  children,
  isActive,
  onUpgradeClick,
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
    }
  };

  const linkClass = `group flex items-center gap-2 rounded-lg border border-transparent px-2.5 text-sm font-medium relative ${
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

interface HeaderProps {
  desktopSidebarOpen?: boolean;
  onDesktopSidebarToggle?: () => void;
}

export default function Header({
  desktopSidebarOpen = true,
  onDesktopSidebarToggle,
}: HeaderProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(desktopSidebarOpen);

  // Sync with controlled prop when provided (e.g. from layout)
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

  // Close mobile sidebar when navigation occurs
  useEffect(() => {
    // Use setTimeout to avoid calling setState synchronously in effect
    const timeoutId = setTimeout(() => {
      setMobileSidebarOpen(false);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [location.pathname]);

  const handleUpgradeClick = (feature: FeatureName, featureName: string) => {
    setUpgradePrompt({ isOpen: true, feature, featureName });
  };

  const closeUpgradePrompt = () => {
    setUpgradePrompt({ isOpen: false, feature: null, featureName: "" });
  };

  return (
    <>
      <nav
        id="page-sidebar"
        aria-label="Main Sidebar Navigation"
        className={`border-border bg-card text-foreground fixed top-0 bottom-0 left-0 z-50 flex h-full w-full flex-col border-r transition-[width,transform] duration-300 ease-out lg:translate-x-0 ${
          isDesktopExpanded ? "lg:w-64" : "lg:w-16"
        } ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Sidebar Header */}
        <div
          className={`bg-card lg:border-border flex h-16 w-full flex-none items-center justify-between border-b border-transparent px-4 transition-[padding] duration-300 lg:justify-center ${
            isDesktopExpanded ? "lg:px-4" : "lg:px-0"
          }`}
        >
          {/* Brand */}
          <Link
            prefetch="intent"
            to="/dashboard"
            className={`group text-foreground hover:text-primary inline-flex items-center transition-colors ${
              isDesktopExpanded ? "gap-2" : "w-full justify-center"
            }`}
            title="SmartFlow Social"
          >
            <Logo
              lightSrc="/logos/Logo-Full-LightMode.svg"
              darkSrc="/logos/Logo-Full-DarkMode.svg"
              alt="SmartFlow Social"
              className={`h-9 w-auto lg:h-10 ${
                isDesktopExpanded ? "" : "lg:h-8 lg:w-8 lg:object-contain"
              }`}
            />
          </Link>
          {/* END Brand */}

          {/* Close Sidebar on Mobile */}
          <div className="lg:hidden">
            <Button
              onClick={() => setMobileSidebarOpen(false)}
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg shadow-none"
            >
              <HiOutlineXMark className="inline-block size-5" />
            </Button>
          </div>
          {/* END Close Sidebar on Mobile */}
        </div>
        {/* END Sidebar Header */}

        {/* Sidebar Navigation */}
        <div className="overflow-x-hidden overflow-y-auto">
          <div
            className={`w-full transition-[padding] duration-300 ${
              isDesktopExpanded ? "p-4" : "p-2 lg:px-2 lg:py-3"
            }`}
          >
            <nav className="space-y-1">
              <NavigationItem
                to="/dashboard"
                feature="dashboard"
                isActive={location.pathname === "/dashboard"}
                onUpgradeClick={handleUpgradeClick}
                icon={
                  <HiOutlineHome className="inline-block size-5 shrink-0" />
                }
                collapsed={!isDesktopExpanded}
              >
                Dashboard
              </NavigationItem>

              {/* Create Section (Expandable) */}
              <ExpandableNavigationSection
                title="Create"
                icon={<HiOutlineCloudArrowUp className="inline-block size-5" />}
                collapsed={!isDesktopExpanded}
                items={[
                  {
                    to: "/dashboard/newpost",
                    feature: "newPost",
                    icon: (
                      <HiOutlineCloudArrowUp className="inline-block size-5" />
                    ),
                    label: "New Post",
                  },
                  {
                    to: "/dashboard/newlongformpost",
                    feature: "longformPosts",
                    icon: (
                      <HiOutlineDocumentText className="inline-block size-5" />
                    ),
                    label: "New Long-form",
                  },
                  {
                    to: "/dashboard/bulkposts",
                    feature: "bulkScheduling",
                    icon: (
                      <HiOutlineSquares2X2 className="inline-block size-5" />
                    ),
                    label: "Bulk Posts",
                  },
                  {
                    to: "/dashboard/drafts",
                    feature: "drafts",
                    icon: (
                      <HiOutlineDocumentText className="inline-block size-5" />
                    ),
                    label: "Drafts",
                  },
                  {
                    to: "/dashboard/templates",
                    feature: "templates",
                    icon: (
                      <HiOutlineDocumentDuplicate className="inline-block size-5" />
                    ),
                    label: "Templates",
                  },
                ]}
                onUpgradeClick={handleUpgradeClick}
              />

              <NavigationItem
                to="/dashboard/calendar"
                feature="calendar"
                isActive={location.pathname.startsWith("/dashboard/calendar")}
                onUpgradeClick={handleUpgradeClick}
                icon={
                  <HiOutlineCalendarDays className="inline-block size-5 shrink-0" />
                }
                collapsed={!isDesktopExpanded}
              >
                Calendar
              </NavigationItem>

              <NavigationItem
                to="/dashboard/scheduled"
                feature="scheduled"
                isActive={location.pathname.startsWith("/dashboard/scheduled")}
                onUpgradeClick={handleUpgradeClick}
                icon={
                  <HiOutlineCalendar className="inline-block size-5 shrink-0" />
                }
                collapsed={!isDesktopExpanded}
              >
                Scheduled
              </NavigationItem>

              <NavigationItem
                to="/dashboard/posted"
                feature="posted"
                isActive={location.pathname.startsWith("/dashboard/posted")}
                onUpgradeClick={handleUpgradeClick}
                icon={
                  <HiOutlineClock className="inline-block size-5 shrink-0" />
                }
                collapsed={!isDesktopExpanded}
              >
                Posted
              </NavigationItem>

              {/* Engagement Section (Expandable) */}
              <ExpandableNavigationSection
                title="Engagement"
                icon={<HiOutlineFire className="inline-block size-5" />}
                collapsed={!isDesktopExpanded}
                items={[
                  {
                    to: "/dashboard/engagement/feed",
                    feature: "engagement_feed",
                    icon: <HiOutlineFire className="inline-block size-5" />,
                    label: "Engagement Feed",
                  },
                  {
                    to: "/dashboard/giveaway?days=7",
                    feature: "giveaways",
                    icon: <HiOutlineGift className="inline-block size-5" />,
                    label: "Giveaway",
                  },
                ]}
                onUpgradeClick={handleUpgradeClick}
              />
            </nav>
          </div>
        </div>
        {/* END Sidebar Navigation */}

        {/* Settings at Bottom */}
        <div
          className={`mt-auto transition-[padding] duration-300 ${
            isDesktopExpanded ? "p-4" : "p-2 lg:px-2 lg:py-3"
          }`}
        >
          <NavigationItem
            to="/dashboard/settings"
            feature="settings"
            isActive={location.pathname === "/dashboard/settings"}
            onUpgradeClick={handleUpgradeClick}
            icon={
              <HiOutlineCog6Tooth className="inline-block size-5 shrink-0" />
            }
            collapsed={!isDesktopExpanded}
          >
            Settings
          </NavigationItem>
        </div>
      </nav>
      {/* Page Sidebar */}

      {/* Page Header */}
      <header
        id="page-header"
        className={`bg-background border-border fixed top-0 right-0 left-0 z-30 flex h-16 flex-none items-center border-b transition-[padding] duration-300 ${isDesktopExpanded ? "lg:pl-64" : "lg:pl-16"}`}
      >
        <div className="max-w-10xl mx-auto flex w-full justify-between px-3 sm:px-4 lg:px-8">
          {/* Left Section */}
          <div className="flex items-center gap-2">
            {/* Toggle Sidebar on Desktop */}
            <div className="hidden lg:block">
              <Button
                onClick={handleDesktopSidebarToggle}
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-lg shadow-none"
              >
                <HiOutlineBars3 className="inline-block size-5" />
              </Button>
            </div>
            {/* END Toggle Sidebar on Desktop */}

            {/* Toggle Sidebar on Mobile */}
            <div className="lg:hidden">
              <Button
                onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-lg shadow-none"
              >
                <HiOutlineBars3 className="inline-block size-5" />
              </Button>
            </div>
            {/* END Toggle Sidebar on Mobile */}
          </div>
          {/* END Left Section */}

          {/* Center Section - Global Search */}
          <div className="flex flex-1 items-center justify-center px-2 sm:px-3 lg:px-6">
            <GlobalSearchBar className="w-full min-w-0" />
          </div>
          {/* END Center Section - Global Search */}

          {/* Right Section */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Menu (Account switching + Logout) */}
            <UserMenu />
          </div>
          {/* END Right Section */}
        </div>
      </header>
      {/* END Page Header */}

      {/* Upgrade Prompt Modal */}
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
