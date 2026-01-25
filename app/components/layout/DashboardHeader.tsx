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
import { Button } from "~/components/ui/button";
import { Logo } from "~/components/ui/Logo";
import { ThemeToggle } from "~/components/ui/ThemeToggle";
import NostrAuthButton from "~/features/auth/components/NostrAuthButton";
import UpgradePrompt from "~/features/payments/components/UpgradePrompt";
import {
  useFeatureAccess,
  useSubscription,
  getMinimumPlanForFeature,
  type FeatureName,
} from "~/features/payments/types";
import AccountSwitchMenu from "~/features/user/components/AccountSwitchMenu";

// Navigation item component with lock functionality
interface NavigationItemProps {
  to: string;
  feature: FeatureName;
  icon: React.ReactNode;
  children: React.ReactNode;
  isActive?: boolean;
  onUpgradeClick: (feature: FeatureName, featureName: string) => void;
}

function NavigationItem({
  to,
  feature,
  icon,
  children,
  isActive,
  onUpgradeClick,
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
    isActive
      ? "bg-muted text-foreground border-border dark:bg-muted dark:text-primary dark:border-border"
      : hasAccess
        ? "text-muted-foreground hover:bg-accent hover:text-accent-foreground active:border-border"
        : "text-muted-foreground/50 cursor-not-allowed opacity-60"
  }`;

  return (
    <Link
      prefetch="intent"
      to={hasAccess ? to : "#"}
      className={linkClass}
      onClick={handleClick}
      title={
        !hasAccess
          ? `Requires ${getMinimumPlanForFeature(feature)} plan`
          : undefined
      }
    >
      <span
        className={`flex flex-none items-center ${isActive ? "text-foreground dark:text-primary" : "text-muted-foreground"}`}
      >
        {icon}
      </span>
      <span className="grow py-2">{children}</span>
      {!hasAccess ? (
        <Lock className="h-4 w-4 flex-shrink-0 text-amber-500" />
      ) : null}
    </Link>
  );
}

export default function Header() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
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
        className={`border-border bg-card text-foreground fixed top-0 bottom-0 left-0 z-50 flex h-full w-full flex-col border-r transition-transform duration-500 ease-out lg:w-64 ${
          desktopSidebarOpen ? "lg:translate-x-0" : "lg:-translate-x-full"
        } ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Sidebar Header */}
        <div className="bg-card flex h-16 w-full flex-none items-center justify-between px-4 lg:justify-center">
          {/* Brand */}
          <Link
            prefetch="intent"
            to="/dashboard"
            className="group text-foreground hover:text-primary inline-flex items-center gap-2 text-lg font-bold tracking-wide transition-colors"
          >
            <Logo
              lightSrc="/logos/Logo-Full-LightMode.svg"
              darkSrc="/logos/Logo-Full-DarkMode.svg"
              alt="SmartFlow Social"
              className="h-8 w-auto"
            />
          </Link>
          {/* END Brand */}

          {/* Close Sidebar on Mobile */}
          <div className="lg:hidden">
            <Button
              onClick={() => setMobileSidebarOpen(false)}
              variant="outline"
              size="sm"
              className="border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <HiOutlineXMark className="-mx-0.5 inline-block size-5" />
            </Button>
          </div>
          {/* END Close Sidebar on Mobile */}
        </div>
        {/* END Sidebar Header */}

        {/* Sidebar Navigation */}
        <div className="overflow-y-auto">
          <div className="w-full p-4">
            <nav className="space-y-1">
              <NavigationItem
                to="/dashboard"
                feature="dashboard"
                isActive={location.pathname === "/dashboard"}
                onUpgradeClick={handleUpgradeClick}
                icon={<HiOutlineHome className="inline-block size-5" />}
              >
                Dashboard
              </NavigationItem>

              {/* Create Section (Expandable) */}
              <ExpandableNavigationSection
                title="Create"
                icon={<HiOutlineCloudArrowUp className="inline-block size-5" />}
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
                icon={<HiOutlineCalendarDays className="inline-block size-5" />}
              >
                Calendar
              </NavigationItem>

              <NavigationItem
                to="/dashboard/scheduled"
                feature="scheduled"
                isActive={location.pathname.startsWith("/dashboard/scheduled")}
                onUpgradeClick={handleUpgradeClick}
                icon={<HiOutlineCalendar className="inline-block size-5" />}
              >
                Scheduled
              </NavigationItem>

              <NavigationItem
                to="/dashboard/posted"
                feature="posted"
                isActive={location.pathname.startsWith("/dashboard/posted")}
                onUpgradeClick={handleUpgradeClick}
                icon={<HiOutlineClock className="inline-block size-5" />}
              >
                Posted
              </NavigationItem>

              {/* Engagement Section (Expandable) */}
              <ExpandableNavigationSection
                title="Engagement"
                icon={<HiOutlineFire className="inline-block size-5" />}
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
        <div className="mt-auto p-4">
          <NavigationItem
            to="/dashboard/settings"
            feature="settings"
            isActive={location.pathname === "/dashboard/settings"}
            onUpgradeClick={handleUpgradeClick}
            icon={<HiOutlineCog6Tooth className="inline-block size-5" />}
          >
            Settings
          </NavigationItem>
        </div>
      </nav>
      {/* Page Sidebar */}

      {/* Page Header */}
      <header
        id="page-header"
        className={`bg-background border-border fixed top-0 right-0 left-0 z-30 flex h-16 flex-none items-center border-b shadow-sm ${desktopSidebarOpen ? "lg:pl-64" : ""}`}
      >
        <div className="max-w-10xl mx-auto flex w-full justify-between px-4 lg:px-8">
          {/* Left Section */}
          <div className="flex items-center gap-2">
            {/* Toggle Sidebar on Desktop */}
            <div className="hidden lg:block">
              <Button
                onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
                variant="outline"
                size="sm"
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
                size="sm"
              >
                <HiOutlineBars3 className="inline-block size-5" />
              </Button>
            </div>
            {/* END Toggle Sidebar on Mobile */}
          </div>
          {/* END Left Section */}

          {/* Center Section - Global Search (Desktop) */}
          <div className="hidden flex-1 items-center lg:flex lg:px-4">
            <GlobalSearchBar className="w-full max-w-xl" />
          </div>
          {/* END Center Section - Global Search (Desktop) */}

          {/* Center Section - Logo (Mobile) */}
          <div className="flex items-center lg:hidden">
            <Link
              prefetch="intent"
              to="/dashboard"
              className="group text-foreground hover:text-primary inline-flex items-center gap-2 text-lg font-bold tracking-wide transition-colors"
            >
              <Logo
                lightSrc="/logos/Logo-Full-LightMode.svg"
                darkSrc="/logos/Logo-Full-DarkMode.svg"
                alt="SmartFlow Social"
                className="h-8 w-auto"
              />
            </Link>
          </div>
          {/* END Center Section - Logo (Mobile) */}

          {/* Right Section */}
          <div className="flex items-center gap-2">
            {/* Global Search (Mobile) */}
            <div className="lg:hidden">
              <GlobalSearchBar className="w-64" />
            </div>
            {/* END Global Search (Mobile) */}

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Account Switcher for Premium/Founder Parents and Child -> Parent */}
            <AccountSwitchMenu />

            {/* Auth / Logout */}
            <NostrAuthButton />
            {/* END User Dropdown */}
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
