import { useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import type { ReactNode } from "react";

import Footer from "~/components/layout/FrontendFooter";
import Header from "~/components/layout/FrontendHeader";
import {
  ErrorMessage,
  FeatureComparisonTable,
  InvoiceModal,
  PaymentSuccessModal,
  PricingCard,
  usePlansState,
} from "~/features/payments";
import type {
  action as plansAction,
  loader as plansLoader,
} from "~/routes/plans";

function parseExpiresAt(expiresAtValue: unknown): string | undefined {
  if (expiresAtValue === null || expiresAtValue === undefined) {
    return undefined;
  }
  if (expiresAtValue instanceof Date) {
    return expiresAtValue.toISOString();
  }
  if (typeof expiresAtValue === "string") {
    return expiresAtValue;
  }
  return undefined;
}

function parseActionData(typedActionData: Record<string, unknown> | null): {
  success?: boolean;
  paid?: boolean;
  invoice?: string;
  paymentHash?: string;
  amount?: number;
  amountUsd?: number;
  paymentId?: string;
  expiresAt?: string;
  planName?: string;
  planId?: string;
  error?: string;
} | null {
  if (!typedActionData) {
    return null;
  }

  return {
    success:
      "success" in typedActionData &&
      typeof typedActionData["success"] === "boolean"
        ? typedActionData["success"]
        : undefined,
    paid:
      "paid" in typedActionData && typeof typedActionData["paid"] === "boolean"
        ? typedActionData["paid"]
        : undefined,
    invoice:
      "invoice" in typedActionData &&
      typeof typedActionData["invoice"] === "string"
        ? typedActionData["invoice"]
        : undefined,
    paymentHash:
      "paymentHash" in typedActionData &&
      typeof typedActionData["paymentHash"] === "string"
        ? typedActionData["paymentHash"]
        : undefined,
    amount:
      "amount" in typedActionData &&
      typeof typedActionData["amount"] === "number"
        ? typedActionData["amount"]
        : undefined,
    amountUsd:
      "amountUsd" in typedActionData &&
      typeof typedActionData["amountUsd"] === "number"
        ? typedActionData["amountUsd"]
        : undefined,
    paymentId:
      "paymentId" in typedActionData &&
      typeof typedActionData["paymentId"] === "string"
        ? typedActionData["paymentId"]
        : undefined,
    expiresAt:
      "expiresAt" in typedActionData
        ? parseExpiresAt(typedActionData["expiresAt"])
        : undefined,
    planName:
      "planName" in typedActionData &&
      typeof typedActionData["planName"] === "string"
        ? typedActionData["planName"]
        : undefined,
    planId:
      "planId" in typedActionData &&
      typeof typedActionData["planId"] === "string"
        ? typedActionData["planId"]
        : undefined,
    error:
      "error" in typedActionData && typeof typedActionData["error"] === "string"
        ? typedActionData["error"]
        : undefined,
  };
}

export function PlansPage(): ReactNode {
  const { plans, user, currentSubscription } =
    useLoaderData<typeof plansLoader>();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Remix action data type is complex, validated at runtime
  const actionData = useActionData<typeof plansAction>();
  const navigation = useNavigation();

  const isLoading = navigation.state === "submitting";

  // Type guard for actionData
  const typedActionData =
    actionData && typeof actionData === "object" && !Array.isArray(actionData)
      ? (actionData as Record<string, unknown>)
      : null;

  const {
    showInvoice,
    invoiceData,
    paymentComplete,
    selectedPlan,
    timeRemaining,
    isPolling,
    handlePlanSelection,
    copyToClipboard,
    checkPaymentStatusNow,
    handleCloseModal,
  } = usePlansState({
    user,
    actionData: parseActionData(typedActionData),
  });

  return (
    <>
      <div className="bg-background relative min-h-screen overflow-hidden">
        {/* Subtle brand color gradient background */}
        <div className="from-secondary/20 to-background dark:from-background/20 absolute inset-0 bg-gradient-to-b via-transparent" />

        <Header />

        <div className="relative container mx-auto px-4 py-16 lg:px-8 lg:py-32 xl:max-w-7xl">
          <div className="mb-16 text-center">
            <div className="border-border bg-muted text-muted-foreground mb-2 inline-flex rounded-full border px-4 py-2 text-sm font-medium">
              Choose the perfect plan for your needs!
            </div>
            <h1 className="text-foreground mb-4 text-4xl font-black">
              Pricing Plans
            </h1>
            <p className="text-muted-foreground mx-auto max-w-2xl text-xl leading-relaxed font-medium">
              Select the perfect plan for your social media automation needs.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="mb-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                isCurrentPlan={currentSubscription?.planId === plan.id}
                isCurrentPlanExpired={currentSubscription?.isExpired ?? false}
                isLoading={isLoading}
                selectedPlan={selectedPlan}
                onPlanSelect={handlePlanSelection}
              />
            ))}
          </div>

          {/* Feature Comparison Table */}
          <FeatureComparisonTable plans={plans} />

          {/* Additional Info */}
          <div className="mt-16 text-center">
            <div className="text-muted-foreground flex flex-wrap justify-center gap-4 text-sm">
              <span>• No setup fees</span>
              <span>• Cancel anytime</span>
              <span>• 30-day money back guarantee</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Success Message */}
      <PaymentSuccessModal
        isOpen={paymentComplete}
        message={
          typedActionData && "message" in typedActionData
            ? typeof typedActionData["message"] === "string"
              ? typedActionData["message"]
              : String(typedActionData["message"])
            : undefined
        }
      />

      {/* Invoice Modal */}
      {invoiceData ? (
        <InvoiceModal
          isOpen={showInvoice}
          invoiceData={invoiceData}
          timeRemaining={timeRemaining}
          isPolling={isPolling}
          onCopy={copyToClipboard}
          onCheckPayment={(id) => {
            void checkPaymentStatusNow(id);
          }}
          onClose={handleCloseModal}
        />
      ) : null}

      {/* Error Message */}
      <ErrorMessage
        message={
          typedActionData && "error" in typedActionData
            ? typeof typedActionData["error"] === "string"
              ? typedActionData["error"]
              : String(typedActionData["error"])
            : ""
        }
      />

      <Footer />
    </>
  );
}

export default PlansPage;
