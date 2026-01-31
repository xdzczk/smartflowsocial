/**
 * Pricing card component
 */

import { Form, Link } from "@remix-run/react";
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
    planId: string
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
            {plan.price === 0 ? "Free" : `$${plan.price}`}
          </span>
          {plan.period ? (
            <span className="text-muted-foreground ml-2">{plan.period}</span>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm">{plan.description}</p>
      </div>

      {isCurrentPlan ? (
        <Link
          to="/dashboard"
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center rounded-lg px-4 py-3 font-medium transition-colors"
        >
          Continue with Current Plan
        </Link>
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
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
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
