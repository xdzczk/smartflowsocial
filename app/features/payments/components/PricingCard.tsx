/**
 * Pricing card component
 */

import { Form, Link } from "@remix-run/react";
import { Loader2 } from "lucide-react";
interface Plan {
  id: string;
  name: string;
  monthlyPriceUsd: number;
  yearlyPriceUsd: number;
  description: string;
  isPopular: boolean;
}

interface PricingCardProps {
  plan: Plan;
  isCurrentPlan: boolean;
  /** When true, user's current plan is expired; show Renew instead of Continue with Current Plan */
  isCurrentPlanExpired: boolean;
  isLoading: boolean;
  selectedPlan: string | null;
  useCheckoutModal: boolean;
  billingCadence: "monthly" | "yearly";
  onPlanSelect: (planId: string) => void;
}

export function PricingCard({
  plan,
  isCurrentPlan,
  isCurrentPlanExpired,
  isLoading,
  selectedPlan,
  useCheckoutModal,
  billingCadence,
  onPlanSelect,
}: PricingCardProps) {
  const isFree = plan.monthlyPriceUsd === 0;
  const displayPriceUsd =
    billingCadence === "yearly" ? plan.yearlyPriceUsd : plan.monthlyPriceUsd;
  const cadenceLabel = isFree
    ? ""
    : billingCadence === "yearly"
      ? "/yr"
      : "/mo";
  const primaryButtonClass =
    "bg-primary text-primary-foreground hover:bg-primary/90";

  const buttonLabel =
    isCurrentPlan && isCurrentPlanExpired
      ? "Renew"
      : isFree
        ? "Get Started"
        : "Choose Plan";

  const isButtonDisabled = isLoading ? selectedPlan === plan.id : false;

  return (
    <div
      className={`border-border bg-card relative rounded-lg border p-6 shadow-lg ${
        plan.isPopular ? "dark:ring-primary/30 ring-border ring-2" : ""
      }`}
    >
      {plan.isPopular ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
          <span className="dark:bg-muted dark:text-muted-foreground border-border text-muted-foreground rounded-full border bg-transparent px-3 py-1 text-sm font-medium dark:border-transparent">
            Most Popular
          </span>
        </div>
      ) : null}

      <div className="mb-6 text-center">
        <h3 className="text-foreground mb-2 text-2xl font-bold">{plan.name}</h3>
        <div className="mb-2">
          <span className="text-foreground text-4xl font-bold">
            {isFree ? "Free" : `$${displayPriceUsd}`}
          </span>
          {cadenceLabel ? (
            <span className="text-muted-foreground ml-2">{cadenceLabel}</span>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm">{plan.description}</p>
      </div>

      {isCurrentPlan && !isCurrentPlanExpired ? (
        <Link
          to="/dashboard"
          className={`${primaryButtonClass} flex w-full items-center justify-center rounded-lg px-4 py-3 font-medium transition-colors`}
        >
          Continue with Current Plan
        </Link>
      ) : (
        <>
          {useCheckoutModal ? (
            <button
              type="button"
              disabled={isButtonDisabled}
              onClick={() => onPlanSelect(plan.id)}
              className={`${primaryButtonClass} w-full rounded-lg px-4 py-3 font-medium transition-colors disabled:opacity-50`}
            >
              {isLoading && selectedPlan === plan.id ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </div>
              ) : (
                buttonLabel
              )}
            </button>
          ) : (
            <Form method="post">
              <input type="hidden" name="intent" value="select_plan" />
              <input type="hidden" name="planId" value={plan.id} />
              <input type="hidden" name="paymentMode" value="manual" />
              <button
                type="submit"
                disabled={isButtonDisabled}
                onClick={() => onPlanSelect(plan.id)}
                className={`${primaryButtonClass} w-full rounded-lg px-4 py-3 font-medium transition-colors disabled:opacity-50`}
              >
                {isLoading && selectedPlan === plan.id ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </div>
                ) : (
                  buttonLabel
                )}
              </button>
            </Form>
          )}
        </>
      )}
    </div>
  );
}
