/**
 * Pricing card component
 */

import { Form } from "@remix-run/react";
import { Loader2 } from "lucide-react";
interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  description: string;
  isPopular: boolean;
}

interface PricingCardProps {
  plan: Plan;
  isCurrentPlan: boolean;
  isLoading: boolean;
  selectedPlan: string | null;
  onPlanSelect: (
    event: React.MouseEvent<HTMLButtonElement>,
    planId: string,
  ) => boolean;
}

export function PricingCard({
  plan,
  isCurrentPlan,
  isLoading,
  selectedPlan,
  onPlanSelect,
}: PricingCardProps) {
  return (
    <div
      className={`relative rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800 ${
        plan.isPopular ? "ring-2 ring-green-500" : ""
      }`}
    >
      {plan.isPopular ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
          <span className="rounded-full bg-green-500 px-3 py-1 text-sm font-medium text-white">
            Most Popular
          </span>
        </div>
      ) : null}

      <div className="mb-6 text-center">
        <h3 className="mb-2 text-2xl font-bold text-black dark:text-white">
          {plan.name}
        </h3>
        <div className="mb-2">
          <span className="text-4xl font-bold text-black dark:text-white">
            {plan.price === 0 ? "Free" : `$${plan.price}`}
          </span>
          {plan.period ? (
            <span className="ml-2 text-gray-500 dark:text-gray-400">
              {plan.period}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {plan.description}
        </p>
      </div>

      {isCurrentPlan ? (
        <div className="w-full rounded-lg bg-green-100 px-4 py-3 text-center font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
          Current Plan
        </div>
      ) : (
        <Form method="post">
          <input type="hidden" name="intent" value="select_plan" />
          <input type="hidden" name="planId" value={plan.id} />
          <button
            type="submit"
            disabled={isLoading ? selectedPlan === plan.id : false}
            onClick={(event) => onPlanSelect(event, plan.id)}
            className={`w-full rounded-lg px-4 py-3 font-medium transition-colors disabled:opacity-50 ${
              plan.isPopular
                ? "bg-green-500 text-white hover:bg-green-600"
                : "bg-blue-700 text-white hover:bg-blue-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            }`}
          >
            {isLoading && selectedPlan === plan.id ? (
              <div className="flex items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </div>
            ) : (
              <>{plan.price === 0 ? "Get Started" : "Choose Plan"}</>
            )}
          </button>
        </Form>
      )}
    </div>
  );
}



