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
const TEXT_MUTED_FOREGROUND = "text-muted-foreground";

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
}

// Separate component for child items to properly use hooks
function NavigationChildItemComponent({
  child,
  isActive,
  onUpgradeClick,
}: {
  child: NavigationChildItem;
  isActive: boolean;
  onUpgradeClick: (feature: FeatureName, featureName: string) => void;
}) {
  const hasAccessByPlan = useFeatureAccess(child.feature);
  const subscription = useSubscription();
  const hasAnySubscription = !!subscription?.currentSubscription;
  const hasAccess = hasAnySubscription && hasAccessByPlan;

  const handleChildClick = (e: React.MouseEvent) => {
    if (!hasAccess) {
      e.preventDefault();
      onUpgradeClick(child.feature, child.label);
    }
  };

  const childLinkClass = `group flex items-center gap-2 rounded-lg border border-transparent px-2.5 text-sm font-medium relative ${
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
      title={
        !hasAccess
          ? `Requires ${getMinimumPlanForFeature(child.feature)} plan`
          : undefined
      }
    >
      <span
        className={`flex flex-none items-center ${isActive ? "text-foreground dark:text-primary" : TEXT_MUTED_FOREGROUND}`}
      >
        {child.icon}
      </span>
      <span className="grow py-2">{child.label}</span>
      {!hasAccess ? (
        <Lock className="h-4 w-4 flex-shrink-0 text-amber-500" />
      ) : null}
    </Link>
  );
}

export function ExpandableNavigationSection({
  title,
  icon,
  items,
  onUpgradeClick,
}: ExpandableNavigationSectionProps) {
  const location = useLocation();

  // Check if any child route is active
  const isAnyChildActive = items.some((child) =>
    location.pathname.startsWith(child.to)
  );

  // Track manual expansion state (user clicked to expand/collapse)
  const previousPathnameRef = useRef(location.pathname);
  const [manuallyExpanded, setManuallyExpanded] = useState<boolean | null>(
    null
  );

  // Check if any child has access - we'll check this in child components
  // For now, we'll show the section if there are any children
  // Individual children will handle their own access checks
  const hasAnyAccessibleChild = items.length > 0;

  // Reset manual expansion state when route changes
  // This is necessary to sync UI state with route changes, which is a valid use case for setState in effects
  useEffect(() => {
    if (previousPathnameRef.current !== location.pathname) {
      previousPathnameRef.current = location.pathname;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- We need to reset manual expansion state when route changes to sync UI with navigation
      setManuallyExpanded(null);
    }
  }, [location.pathname]);

  // Compute expanded state: use manual state if set, otherwise use active child state
  const isExpanded = manuallyExpanded ?? isAnyChildActive;

  // Hide section if no children are accessible
  if (!hasAnyAccessibleChild) {
    return null;
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

  const parentClass = `group flex items-center gap-2 rounded-lg border border-transparent px-2.5 text-sm font-medium relative cursor-pointer ${
    isAnyChildActive
      ? "bg-muted text-foreground border-border dark:bg-muted dark:text-primary dark:border-border"
      : "text-muted-foreground hover:bg-muted hover:text-foreground active:border-border"
  }`;

  return (
    <div className="space-y-1">
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
          className={`flex flex-none items-center ${isAnyChildActive ? "text-foreground dark:text-primary" : TEXT_MUTED_FOREGROUND}`}
        >
          {icon}
        </span>
        <span className="grow py-2 text-left">{title}</span>
        <span
          className={`flex flex-none items-center ${isAnyChildActive ? TEXT_PRIMARY : TEXT_MUTED_FOREGROUND} transition-transform duration-200 ease-in-out ${
            isExpanded ? "rotate-180" : "rotate-0"
          }`}
        >
          <ChevronDown className="h-4 w-4" />
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
            const isActive = location.pathname.startsWith(child.to);
            return (
              <NavigationChildItemComponent
                key={child.to}
                child={child}
                isActive={isActive}
                onUpgradeClick={onUpgradeClick}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
