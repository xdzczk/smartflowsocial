import { Link, useLocation } from "@remix-run/react";
import { ChevronDown, Lock } from "lucide-react";
import { useEffect, useState } from "react";

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
      ? "bg-muted text-primary border-border"
      : hasAccess
        ? "text-muted-foreground hover:bg-accent hover:text-accent-foreground active:border-border"
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
        className={`flex flex-none items-center ${isActive ? TEXT_PRIMARY : TEXT_MUTED_FOREGROUND}`}
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
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if any child has access - we'll check this in child components
  // For now, we'll show the section if there are any children
  // Individual children will handle their own access checks
  const hasAnyAccessibleChild = items.length > 0;

  // Auto-expand when any child route is active
  useEffect(() => {
    const isAnyChildActive = items.some((child) =>
      location.pathname.startsWith(child.to)
    );
    // Use setTimeout to avoid calling setState synchronously in effect
    const timeoutId = setTimeout(() => {
      setIsExpanded(isAnyChildActive);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [location.pathname, items]);

  // Hide section if no children are accessible
  if (!hasAnyAccessibleChild) {
    return null;
  }

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleExpanded();
    }
  };

  // Check if any child is currently active
  const isAnyChildActive = items.some((child) =>
    location.pathname.startsWith(child.to)
  );

  const parentClass = `group flex items-center gap-2 rounded-lg border border-transparent px-2.5 text-sm font-medium relative cursor-pointer ${
    isAnyChildActive
      ? "bg-muted text-primary border-border"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground active:border-border"
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
          className={`flex flex-none items-center ${isAnyChildActive ? TEXT_PRIMARY : TEXT_MUTED_FOREGROUND}`}
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
