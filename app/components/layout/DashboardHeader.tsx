import { Link, useLocation } from "@remix-run/react";
import { Lock } from "lucide-react";
import { useState } from "react";
import {
  HiOutlineHome,
  HiOutlineCalendarDays,
  HiOutlineDocumentText,
  HiOutlineCloudArrowUp,
  HiOutlineSquares2X2,
  HiOutlineDocumentDuplicate,
  HiOutlineArrowPath,
  HiOutlineCalendar,
  HiOutlineClock,
  HiOutlineGift,
  HiOutlineFire,
  HiOutlineMagnifyingGlass,
  HiOutlineCog6Tooth,
  HiOutlineBars3,
  HiOutlineXMark,
} from "react-icons/hi2";

import { Button } from "~/components/ui/button";
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
      ? "bg-gray-700/75 text-white"
      : hasAccess
        ? "text-gray-300 hover:bg-gray-700/75 hover:text-white active:border-gray-700"
        : "text-gray-500 cursor-not-allowed opacity-60"
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
      <span className="flex flex-none items-center text-gray-300">{icon}</span>
      <span className="grow py-2">{children}</span>
      {!hasAccess ? <Lock className="h-4 w-4 flex-shrink-0 text-amber-500" /> : null}
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
        className={`fixed bottom-0 left-0 top-0 z-50 flex h-full w-full flex-col border-r border-gray-800 bg-gray-800 text-gray-200 transition-transform duration-500 ease-out lg:w-64 ${
          desktopSidebarOpen ? "lg:translate-x-0" : "lg:-translate-x-full"
        } ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 w-full flex-none items-center justify-between bg-gray-600/25 px-4 lg:justify-center">
          {/* Brand */}
          <Link
            prefetch="intent"
            to="/dashboard"
            className="group inline-flex items-center gap-2 text-lg font-bold tracking-wide text-gray-100 hover:text-gray-300"
          >
            <svg
              className="size-8 text-blue-600 dark:text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2C6.477 2 2 6.477 2 12c0 5.523 4.477 10 10 10s10-4.477 10-10c0-5.523-4.477-10-10-10zm0 18c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8zm1-11h-2v3H8v2h3v3h2v-3h3v-2h-3V9z" />
            </svg>
            <span>SmartFlow Social</span>
          </Link>
          {/* END Brand */}

          {/* Close Sidebar on Mobile */}
          <div className="lg:hidden">
            <Button
              onClick={() => setMobileSidebarOpen(false)}
              variant="outline"
              size="sm"
              className="border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600 hover:bg-gray-700 hover:text-gray-200"
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
                to="/dashboard/drafts"
                feature="drafts"
                isActive={location.pathname.startsWith("/dashboard/drafts")}
                onUpgradeClick={handleUpgradeClick}
                icon={<HiOutlineDocumentText className="inline-block size-5" />}
              >
                Drafts
              </NavigationItem>
              <NavigationItem
                to="/dashboard/newpost"
                feature="newPost"
                isActive={location.pathname === "/dashboard/newpost"}
                onUpgradeClick={handleUpgradeClick}
                icon={<HiOutlineCloudArrowUp className="inline-block size-5" />}
              >
                New Post
              </NavigationItem>
              <NavigationItem
                to="/dashboard/newlongformpost"
                feature="longformPosts"
                isActive={location.pathname === "/dashboard/newlongformpost"}
                onUpgradeClick={handleUpgradeClick}
                icon={<HiOutlineDocumentText className="inline-block size-5" />}
              >
                New Long-form
              </NavigationItem>
              <NavigationItem
                to="/dashboard/bulkposts"
                feature="bulkScheduling"
                isActive={location.pathname === "/dashboard/bulkposts"}
                onUpgradeClick={handleUpgradeClick}
                icon={<HiOutlineSquares2X2 className="inline-block size-5" />}
              >
                Bulk Posts
              </NavigationItem>
              <NavigationItem
                to="/dashboard/templates"
                feature="templates"
                isActive={location.pathname.startsWith("/dashboard/templates")}
                onUpgradeClick={handleUpgradeClick}
                icon={
                  <HiOutlineDocumentDuplicate className="inline-block size-5" />
                }
              >
                Templates
              </NavigationItem>
              <NavigationItem
                to="/dashboard/recyclables"
                feature="recyclables"
                isActive={location.pathname.startsWith(
                  "/dashboard/recyclables",
                )}
                onUpgradeClick={handleUpgradeClick}
                icon={<HiOutlineArrowPath className="inline-block size-5" />}
              >
                Recyclables
              </NavigationItem>
              <NavigationItem
                to="/dashboard/scheduled"
                feature="scheduled"
                isActive={location.pathname.startsWith("/dashboard/scheduled")}
                onUpgradeClick={handleUpgradeClick}
                icon={<HiOutlineCalendar className="inline-block size-5" />}
              >
                Scheduled Posts
              </NavigationItem>
              <NavigationItem
                to="/dashboard/posted"
                feature="posted"
                isActive={location.pathname.startsWith("/dashboard/posted")}
                onUpgradeClick={handleUpgradeClick}
                icon={<HiOutlineClock className="inline-block size-5" />}
              >
                Posted History
              </NavigationItem>
              <NavigationItem
                to="/dashboard/giveaway?days=7"
                feature="giveaways"
                isActive={location.pathname.startsWith("/dashboard/giveaway")}
                onUpgradeClick={handleUpgradeClick}
                icon={<HiOutlineGift className="inline-block size-5" />}
              >
                Giveaway
              </NavigationItem>
              <NavigationItem
                to="/dashboard/engagement/feed"
                feature="engagement_feed"
                isActive={location.pathname.startsWith(
                  "/dashboard/engagement/feed",
                )}
                onUpgradeClick={handleUpgradeClick}
                icon={<HiOutlineFire className="inline-block size-5" />}
              >
                Engagement Feed
              </NavigationItem>
              <NavigationItem
                to="/dashboard/search/posts"
                feature="dashboard"
                isActive={location.pathname.startsWith(
                  "/dashboard/search/posts",
                )}
                onUpgradeClick={handleUpgradeClick}
                icon={
                  <HiOutlineMagnifyingGlass className="inline-block size-5" />
                }
              >
                Search Posts
              </NavigationItem>
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
        className={`fixed left-0 right-0 top-0 z-30 flex h-16 flex-none items-center bg-white shadow-sm dark:bg-gray-800 ${desktopSidebarOpen ? "lg:pl-64" : ""}`}
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

          {/* Center Section */}
          <div className="flex items-center lg:hidden">
            <Link
              prefetch="intent"
              to="/dashboard"
              className="group inline-flex items-center gap-2 text-lg font-bold tracking-wide text-gray-900 hover:text-gray-600 dark:text-gray-100 dark:hover:text-gray-300"
            >
              <svg
                className="size-8 text-blue-600 dark:text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.477 2 2 6.477 2 12c0 5.523 4.477 10 10 10s10-4.477 10-10c0-5.523-4.477-10-10-10zm0 18c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8zm1-11h-2v3H8v2h3v3h2v-3h3v-2h-3V9z" />
              </svg>
              <span className="hidden sm:inline">SmartFlow Social</span>
            </Link>
          </div>
          {/* END Center Section */}

          {/* Right Section */}
          <div className="flex items-center gap-2">
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
      {upgradePrompt.feature ? <UpgradePrompt
          isOpen={upgradePrompt.isOpen}
          onClose={closeUpgradePrompt}
          feature={upgradePrompt.feature}
          featureName={upgradePrompt.featureName}
        /> : null}
    </>
  );
}
