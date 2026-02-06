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
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="dark:bg-card mx-4 max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
              <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-foreground text-lg font-semibold dark:text-white">
                Feature Locked
              </h3>
              <p className="text-foreground dark:text-foreground text-sm">
                Upgrade required
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-foreground hover:text-foreground dark:hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-muted-foreground dark:text-foreground">
            <strong>{featureName}</strong> requires a{" "}
            <span className="text-foreground dark:text-muted-foreground font-semibold capitalize">
              {minPlan}
            </span>{" "}
            plan or higher.
          </p>
          <p className="text-foreground dark:text-foreground mt-2 text-sm">
            Upgrade your plan to unlock this feature and many more advanced
            tools for your social media automation.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            to="/plans"
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring flex-1 rounded-lg px-4 py-2 text-center font-medium focus:ring-2 focus:ring-offset-0 focus:outline-none"
          >
            View Plans
          </Link>
          <button
            onClick={onClose}
            className="border-border text-muted-foreground hover:bg-muted dark:border-border dark:text-foreground dark:hover:bg-muted focus:ring-ring flex-1 rounded-lg border px-4 py-2 font-medium focus:ring-2 focus:ring-offset-0 focus:outline-none"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
