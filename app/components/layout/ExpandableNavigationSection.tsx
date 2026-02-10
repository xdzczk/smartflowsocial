import { Link, useLocation } from "@remix-run/react";
import { ChevronDown, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  useFeatureAccess,
  useSubscription,
  getMinimumPlanForFeature,
  type FeatureName,
} from "~/features/payments/types";

const TEXT_PRIMARY = "text-primary";
// Inactive nav icons: slightly higher contrast than inactive text; match link hover so icon and text react together
const TEXT_NAV_ICON_INACTIVE = "text-foreground/70 group-hover:text-foreground";
const NAV_ICON_STROKE = 2.25;

/** Pathname only (no search or hash) so active state matches when link has query params e.g. /dashboard/giveaway?days=7 */
function getPathname(href: string): string {
  const withoutQuery = href.split("?")[0] ?? href;
  return withoutQuery.split("#")[0] ?? withoutQuery;
}

interface NavigationChildItem {
  to: string;
  feature: FeatureName;
  icon: React.ReactNode;
  label: string;
}

interface ExpandableNavigationSectionProps {
  title: string;
  icon: React.ReactNode;
  items: NavigationChildItem[];
  onUpgradeClick: (feature: FeatureName, featureName: string) => void;
  /** When provided and child link is active (current page), click closes sidebar instead of navigating (e.g. mobile) */
  onActiveClick?: () => void;
  collapsed?: boolean;
}

// Separate component for child items to properly use hooks
function NavigationChildItemComponent({
  child,
  isActive,
  onUpgradeClick,
  onActiveClick,
  collapsed = false,
  sectionExpanded = true,
}: {
  child: NavigationChildItem;
  isActive: boolean;
  onUpgradeClick: (feature: FeatureName, featureName: string) => void;
  /** When provided and link is active, click closes sidebar instead of navigating (e.g. mobile) */
  onActiveClick?: () => void;
  collapsed?: boolean;
  /** When false, link is not focusable (tabIndex=-1) so keyboard nav doesn't land on hidden items */
  sectionExpanded?: boolean;
}) {
  const hasAccessByPlan = useFeatureAccess(child.feature);
  const subscription = useSubscription();
  const hasAnySubscription = !!subscription?.currentSubscription;
  const hasAccess = hasAnySubscription && hasAccessByPlan;

  const handleChildClick = (e: React.MouseEvent) => {
    if (!hasAccess) {
      e.preventDefault();
      onUpgradeClick(child.feature, child.label);
      return;
    }
    if (isActive && onActiveClick) {
      e.preventDefault();
      onActiveClick();
    }
  };

  const title = !hasAccess
    ? `Requires ${getMinimumPlanForFeature(child.feature)} plan`
    : child.label;

  const childLinkClass = `group flex items-center rounded-lg border border-transparent text-sm font-medium relative focus:outline-none focus:ring-2 focus:ring-ring ${
    collapsed ? "justify-center px-0 py-2" : "gap-2 px-2.5"
  } ${
    isActive
      ? "bg-muted text-foreground border-border dark:bg-muted dark:text-primary dark:border-border"
      : hasAccess
        ? "text-muted-foreground hover:bg-muted hover:text-foreground active:border-border"
        : "text-muted-foreground/50 cursor-not-allowed opacity-60"
  }`;

  return (
    <Link
      prefetch="intent"
      to={hasAccess ? child.to : "#"}
      className={childLinkClass}
      onClick={handleChildClick}
      title={title}
      tabIndex={sectionExpanded ? undefined : -1}
    >
      <span
        className={`flex flex-none shrink-0 items-center ${isActive ? "text-foreground dark:text-primary" : TEXT_NAV_ICON_INACTIVE}`}
      >
        {child.icon}
      </span>
      {!collapsed ? (
        <>
          <span className="grow py-2">{child.label}</span>
          {!hasAccess ? (
            <Lock
              className="h-4 w-4 flex-shrink-0 text-amber-500"
              strokeWidth={NAV_ICON_STROKE}
            />
          ) : null}
        </>
      ) : null}
    </Link>
  );
}

export function ExpandableNavigationSection({
  title,
  icon,
  items,
  onUpgradeClick,
  onActiveClick,
  collapsed = false,
}: ExpandableNavigationSectionProps) {
  const location = useLocation();

  // Check if any child route is active (use pathname only so links with query params e.g. /dashboard/giveaway?days=7 still highlight)
  const isAnyChildActive = items.some((child) =>
    location.pathname.startsWith(getPathname(child.to))
  );

  // Track manual expansion state (user clicked to expand/collapse)
  const previousPathnameRef = useRef(location.pathname);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [manuallyExpanded, setManuallyExpanded] = useState<boolean | null>(
    null
  );

  // Check if any child has access - we'll check this in child components
  // For now, we'll show the section if there are any children
  // Individual children will handle their own access checks
  const hasAnyAccessibleChild = items.length > 0;

  // Reset manual expansion state when route changes
  useEffect(() => {
    if (previousPathnameRef.current !== location.pathname) {
      previousPathnameRef.current = location.pathname;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync UI with navigation: reset manual expand when route changes
      setManuallyExpanded(null);
    }
  }, [location.pathname]);

  // Compute expanded state: use manual state if set, otherwise use active child state
  const isExpanded = manuallyExpanded ?? isAnyChildActive;

  // Hide section if no children are accessible
  if (!hasAnyAccessibleChild) {
    return null;
  }

  // Collapsed: show only icon-only child links (no parent button, no expand/collapse)
  if (collapsed) {
    return (
      <div className="space-y-1">
        {items.map((child) => {
          const isActive = location.pathname.startsWith(getPathname(child.to));
          return (
            <NavigationChildItemComponent
              key={child.to}
              child={child}
              isActive={isActive}
              onUpgradeClick={onUpgradeClick}
              onActiveClick={onActiveClick}
              collapsed
            />
          );
        })}
      </div>
    );
  }

  const toggleExpanded = () => {
    setManuallyExpanded(!isExpanded);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleExpanded();
    }
  };

  const handleBlurCapture = () => {
    // After focus leaves, check if it went outside this section; if so, collapse.
    // Do not collapse when current route is a child of this section (e.g. user navigated to longform composer).
    setTimeout(() => {
      const container = sectionRef.current;
      if (
        container &&
        !container.contains(document.activeElement) &&
        !isAnyChildActive
      ) {
        setManuallyExpanded(false);
      }
    }, 0);
  };

  const parentClass = `group flex items-center gap-2 rounded-lg border border-transparent px-2.5 text-sm font-medium relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring ${
    isAnyChildActive
      ? "bg-muted text-foreground border-border dark:bg-muted dark:text-primary dark:border-border"
      : "text-muted-foreground hover:bg-muted hover:text-foreground active:border-border"
  }`;

  return (
    <div
      ref={sectionRef}
      className="space-y-1"
      onBlurCapture={handleBlurCapture}
    >
      {/* Parent Section Header */}
      <button
        type="button"
        onClick={toggleExpanded}
        onKeyDown={handleKeyDown}
        className={parentClass}
        aria-expanded={isExpanded}
        aria-controls={`${title.toLowerCase().replace(/\s+/g, "-")}-section-content`}
      >
        <span
          className={`flex flex-none items-center ${isAnyChildActive ? "text-foreground dark:text-primary" : TEXT_NAV_ICON_INACTIVE}`}
        >
          {icon}
        </span>
        <span className="grow py-2 text-left">{title}</span>
        <span
          className={`flex flex-none items-center ${isAnyChildActive ? TEXT_PRIMARY : TEXT_NAV_ICON_INACTIVE} transition-transform duration-200 ease-in-out ${
            isExpanded ? "rotate-180" : "rotate-0"
          }`}
        >
          <ChevronDown className="h-4 w-4" strokeWidth={NAV_ICON_STROKE} />
        </span>
      </button>

      {/* Children Items */}
      <div
        id={`${title.toLowerCase().replace(/\s+/g, "-")}-section-content`}
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="space-y-1 pl-8">
          {items.map((child) => {
            const isActive = location.pathname.startsWith(
              getPathname(child.to)
            );
            return (
              <NavigationChildItemComponent
                key={child.to}
                child={child}
                isActive={isActive}
                onUpgradeClick={onUpgradeClick}
                onActiveClick={onActiveClick}
                sectionExpanded={isExpanded}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
