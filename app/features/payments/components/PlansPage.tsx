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
  } = usePlansState({
    user,
    actionData: parseActionData(typedActionData),
  });

  return (
    <>
      <div className="relative overflow-hidden bg-white dark:bg-gray-900 dark:text-gray-100">
        <div className="absolute top-0 right-0 left-0 flex h-64 opacity-70 dark:opacity-50">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white dark:to-gray-900" />
          <div className="grow bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900" />
          <div className="grow bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900 dark:to-teal-900" />
          <div className="grow bg-gradient-to-r from-teal-100 to-cyan-100 dark:from-teal-900 dark:to-cyan-900" />
          <div className="grow bg-gradient-to-r from-cyan-100 to-sky-100 dark:from-cyan-900 dark:to-sky-900" />
          <div className="grow bg-gradient-to-r from-sky-100 to-blue-100 dark:from-sky-900 dark:to-blue-900" />
          <div className="grow bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900" />
          <div className="grow bg-gradient-to-r from-indigo-100 to-violet-100 dark:from-indigo-900 dark:to-violet-900" />
          <div className="grow bg-gradient-to-r from-violet-100 to-purple-100 dark:from-violet-900 dark:to-purple-900" />
          <div className="grow bg-gradient-to-r from-purple-100 to-fuchsia-100 dark:from-purple-900 dark:to-fuchsia-900" />
          <div className="grow bg-gradient-to-r from-fuchsia-100 to-pink-100 dark:from-fuchsia-900 dark:to-pink-900" />
          <div className="grow bg-gradient-to-r from-pink-100 to-rose-100 dark:from-pink-900 dark:to-rose-900" />
        </div>

        <Header />

        <div className="relative container mx-auto px-4 py-16 lg:px-8 lg:py-32 xl:max-w-7xl">
          <div className="mb-16 text-center">
            <div className="mb-2 inline-flex rounded border border-amber-300 bg-amber-200 px-2 py-1 text-sm leading-4 font-medium text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/50 dark:text-amber-200">
              Choose the perfect plan for your needs!
            </div>
            <h1 className="mb-4 text-4xl font-black text-black dark:text-white">
              Pricing Plans
            </h1>
            <p className="mx-auto max-w-2xl text-xl leading-relaxed font-medium text-gray-700 dark:text-gray-300">
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
            <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
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
