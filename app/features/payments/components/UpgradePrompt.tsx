import { Link } from "@remix-run/react";
import { Lock, X } from "lucide-react";

import { getMinimumPlanForFeature, type FeatureName } from "~/features/payments/types";

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
  featureName 
}: UpgradePromptProps) {
  if (!isOpen) return null;

  const minPlan = getMinimumPlanForFeature(feature);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
              <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Feature Locked
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Upgrade required
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-700 dark:text-gray-300">
            <strong>{featureName}</strong> requires a{" "}
            <span className="font-semibold text-blue-600 dark:text-blue-400 capitalize">
              {minPlan}
            </span>{" "}
            plan or higher.
          </p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Upgrade your plan to unlock this feature and many more advanced tools 
            for your social media automation.
          </p>
        </div>
        
        <div className="flex gap-3">
          <Link
            to="/plans"
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-center font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            View Plans
          </Link>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}