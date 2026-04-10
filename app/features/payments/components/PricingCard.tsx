/**
 * Pricing card component (main grid recurring tiers + Free).
 */

import { Form, Link } from "@remix-run/react";
import { Loader2 } from "lucide-react";

import type { PricingPagePlan } from "~/features/payments/types/plan-loader.types";

interface PricingCardProps {
  plan: PricingPagePlan;
  isCurrentPlan: boolean;
  isCurrentPlanExpired: boolean;
  isLoading: boolean;
  selectedPlan: string | null;
  useCheckoutModal: boolean;
  billingCadence: "monthly" | "yearly";
  onPlanSelect: (planId: string) => void;
}

function cadenceSuffix(
  isFree: boolean,
  isTeams: boolean,
  isRecurring: boolean,
  billingCadence: "monthly" | "yearly"
): string {
  if (isFree || isTeams) return "";
  if (isRecurring && billingCadence === "yearly") return "/yr";
  if (isRecurring) return "/mo";
  return "";
}

function planCtaLabel(
  plan: PricingPagePlan,
  isTeams: boolean,
  isCurrentPlan: boolean,
  isCurrentPlanExpired: boolean,
  isFree: boolean
): string {
  if (isTeams) return "Coming soon";
  if (isCurrentPlan && !isCurrentPlanExpired) return "Current plan";
  if (isCurrentPlan && isCurrentPlanExpired) return "Renew";
  if (isFree) return "Start free";
  if (plan.id === "starter") return "Choose Starter";
  if (plan.id === "creator") return "Choose Creator";
  if (plan.id === "pro") return "Choose Pro";
  return "Choose plan";
}

function PricingCardCta({
  plan,
  primaryButtonClass,
  label,
  isButtonDisabled,
  isLoading,
  selectedPlan,
  useCheckoutModal,
  isTeams,
  onPlanSelect,
}: {
  plan: PricingPagePlan;
  primaryButtonClass: string;
  label: string;
  isButtonDisabled: boolean;
  isLoading: boolean;
  selectedPlan: string | null;
  useCheckoutModal: boolean;
  isTeams: boolean;
  onPlanSelect: (planId: string) => void;
}) {
  const showSpinner = isLoading && selectedPlan === plan.id;
  const buttonContent = showSpinner ? (
    <div className="flex items-center justify-center">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Processing...
    </div>
  ) : (
    label
  );

  if (useCheckoutModal) {
    return (
      <button
        type="button"
        disabled={isButtonDisabled}
        onClick={() => {
          if (!isTeams) onPlanSelect(plan.id);
        }}
        className={`${primaryButtonClass} focus-visible:ring-primary/40 w-full rounded-lg px-4 py-3 text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55`}
      >
        {buttonContent}
      </button>
    );
  }

  return (
    <Form method="post">
      <input type="hidden" name="intent" value="select_plan" />
      <input type="hidden" name="planId" value={plan.id} />
      <input type="hidden" name="paymentMode" value="manual" />
      <button
        type="submit"
        disabled={isButtonDisabled}
        onClick={() => onPlanSelect(plan.id)}
        className={`${primaryButtonClass} focus-visible:ring-primary/40 w-full rounded-lg px-4 py-3 text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55`}
      >
        {buttonContent}
      </button>
    </Form>
  );
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
  const isTeams = plan.isTeamsPlaceholder;
  const isFree = plan.planBillingModel === "free";
  const isRecurring = plan.planBillingModel === "recurring";
  const bulletTextClass = isTeams
    ? "text-foreground/75"
    : "text-muted-foreground";

  const displayPriceUsd = isRecurring
    ? billingCadence === "yearly"
      ? plan.yearlyPriceUsd
      : plan.monthlyPriceUsd
    : 0;

  const cadenceLabel = cadenceSuffix(
    isFree,
    isTeams,
    isRecurring,
    billingCadence
  );

  const primaryButtonClass = isTeams
    ? "bg-muted text-muted-foreground cursor-not-allowed"
    : "bg-primary text-primary-foreground hover:bg-primary/90";

  const label = planCtaLabel(
    plan,
    isTeams,
    isCurrentPlan,
    isCurrentPlanExpired,
    isFree
  );
  const isButtonDisabled =
    isTeams ||
    !plan.purchasable ||
    (isLoading ? selectedPlan === plan.id : false);

  const cardClass = isTeams
    ? "border-border bg-muted/20 relative flex h-full flex-col rounded-xl border p-4 pt-6 shadow-sm sm:p-5 sm:pt-6"
    : `border-border relative flex h-full flex-col rounded-xl border bg-card p-4 pt-6 shadow-md sm:p-5 sm:pt-6 ${
        plan.isPopular
          ? "border-primary/35 ring-primary/25 shadow-lg ring-2"
          : "hover:border-border/90 hover:shadow-lg"
      }`;

  return (
    <div className={cardClass}>
      {plan.isPopular && !isTeams ? (
        <div className="absolute -top-2.5 right-0 left-0 z-10 flex justify-center px-2">
          <span className="bg-card text-foreground/90 border-border inline-flex max-w-full items-center justify-center rounded-full border px-3 py-1 text-center text-xs font-semibold tracking-wide whitespace-nowrap shadow-sm">
            Most popular
          </span>
        </div>
      ) : null}
      {plan.id === "pro" && !isTeams ? (
        <div className="absolute -top-2.5 right-0 left-0 z-10 flex justify-center px-2">
          <span className="bg-card text-muted-foreground border-border inline-flex max-w-full items-center justify-center rounded-full border px-3 py-1 text-center text-xs font-semibold whitespace-nowrap shadow-sm">
            Multi-account
          </span>
        </div>
      ) : null}
      {isTeams ? (
        <div className="absolute -top-2.5 right-0 left-0 z-10 flex justify-center px-2">
          <span className="bg-muted text-muted-foreground border-border inline-flex max-w-full items-center justify-center rounded-full border px-3 py-1 text-center text-xs font-medium whitespace-nowrap">
            Coming soon
          </span>
        </div>
      ) : null}

      <div className="mb-4 text-center">
        <h3 className="text-foreground mb-1.5 text-[1.55rem] font-bold tracking-tight">
          {plan.name}
        </h3>
        <div className="mb-1.5 min-h-[3rem]">
          {isTeams ? (
            <span className="text-foreground text-2xl font-semibold">
              Coming soon
            </span>
          ) : isFree ? (
            <span className="text-foreground text-4xl font-bold tracking-tight">
              Free
            </span>
          ) : (
            <>
              <span className="text-foreground text-4xl font-bold tracking-tight tabular-nums">
                ${displayPriceUsd}
              </span>
              {cadenceLabel ? (
                <span className="text-muted-foreground ml-1.5 text-base font-medium">
                  {cadenceLabel}
                </span>
              ) : null}
            </>
          )}
        </div>
        {isRecurring &&
        billingCadence === "yearly" &&
        plan.yearlySavingsNote ? (
          <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide">
            {plan.yearlySavingsNote}
          </p>
        ) : null}
        <p className="text-muted-foreground/90 min-h-[2.75rem] text-sm leading-relaxed">
          {plan.description}
        </p>
      </div>

      <div className="flex-1">
        {plan.callouts.length > 0 ? (
          <ul
            className={`${bulletTextClass} mb-4 space-y-1.5 text-left text-sm`}
          >
            {plan.callouts.map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <span className="text-primary mt-0.5 shrink-0 text-xs">●</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {isCurrentPlan && !isCurrentPlanExpired && !isTeams ? (
        <Link
          to="/dashboard"
          className="border-border bg-secondary/70 text-secondary-foreground hover:bg-secondary/90 focus-visible:ring-primary/40 flex w-full items-center justify-center rounded-lg border px-4 py-3 text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
        >
          Current plan
        </Link>
      ) : (
        <PricingCardCta
          plan={plan}
          primaryButtonClass={primaryButtonClass}
          label={label}
          isButtonDisabled={isButtonDisabled}
          isLoading={isLoading}
          selectedPlan={selectedPlan}
          useCheckoutModal={useCheckoutModal}
          isTeams={isTeams}
          onPlanSelect={onPlanSelect}
        />
      )}
    </div>
  );
}
