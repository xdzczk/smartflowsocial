import { Link } from "@remix-run/react";
import { Lock, X } from "lucide-react";

import { getMinimumPlanForFeature, type FeatureName } from "../types";
interface UpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
  feature: FeatureName;
  featureName: string;
}

export default function UpgradePrompt({
  isOpen,
  onClose,
  feature,
  featureName,
}: UpgradePromptProps) {
  if (!isOpen) return null;

  const minPlan = getMinimumPlanForFeature(feature);

  return (
    <div className="bg-scrim/50 fixed inset-0 z-50 flex items-center justify-center">
      <div className="bg-surface-overlay shadow-3 inset-card-lg mx-4 max-w-md rounded-xl">
        <div className="mb-4 flex items-start justify-between">
          <div className="cluster-loose">
            <div className="bg-warning/12 dark:bg-warning/15 flex h-10 w-10 items-center justify-center rounded-full">
              <Lock className="text-warning dark:text-warning h-5 w-5" />
            </div>
            <div>
              <h3 className="text-text text-lg font-semibold">
                Feature Locked
              </h3>
              <p className="text-text text-sm">Upgrade required</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text hover:text-text dark:hover:text-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-text-secondary">
            <strong>{featureName}</strong> requires a{" "}
            <span className="text-text font-semibold capitalize">
              {minPlan}
            </span>{" "}
            plan or higher.
          </p>
          <p className="text-text mt-2 text-sm">
            Upgrade your plan to unlock this feature and many more advanced
            tools for your social media automation.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            to="/plans"
            className="focus-ring bg-action-primary text-action-primary-foreground hover:bg-action-primary/90 flex-1 rounded-lg px-4 py-2 text-center font-medium"
          >
            View Plans
          </Link>
          <button
            onClick={onClose}
            className="focus-ring border-border text-text-secondary hover:bg-surface-hover dark:border-border dark:text-text dark:hover:bg-surface-hover flex-1 rounded-lg border px-4 py-2 font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
