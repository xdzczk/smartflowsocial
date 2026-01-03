import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigation } from "@remix-run/react";

import Footer from "~/components/layout/FrontendFooter";
import Header from "~/components/layout/FrontendHeader";
import {
  ErrorMessage,
  FeatureComparisonTable,
  InvoiceModal,
  PaymentSuccessModal,
  PricingCard,
  usePlansState,
  handlePlansAction,
  loadPlansData,
} from "~/features/payments";
import { withCSRFProtection } from "~/lib/csrf.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Pricing Plans - SmartFlow Social" },
    {
      name: "description",
      content:
        "Choose the perfect plan for your social media automation needs.",
    },
  ];
};

export const action = withCSRFProtection(async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const result = await handlePlansAction(formData, request);

  if (result.redirect) {
    return redirect(result.redirect);
  }

  if (result.error) {
    return json(result, { status: 400 });
  }

  return json(result);
});

export const loader = async ({ request }: { request: Request }) => {
  const data = await loadPlansData(request);
  return json(data);
};

export default function Plans() {
  const { plans, user, currentSubscription } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isLoading = navigation.state === "submitting";

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
    actionData:
      actionData && typeof actionData === "object" && !Array.isArray(actionData)
        ? {
            success: "success" in actionData ? actionData.success : undefined,
            paid: "paid" in actionData ? actionData.paid : undefined,
            invoice: "invoice" in actionData ? actionData.invoice : undefined,
            paymentHash:
              "paymentHash" in actionData ? actionData.paymentHash : undefined,
            amount: "amount" in actionData ? actionData.amount : undefined,
            amountUsd:
              "amountUsd" in actionData ? actionData.amountUsd : undefined,
            paymentId:
              "paymentId" in actionData ? actionData.paymentId : undefined,
            expiresAt:
              "expiresAt" in actionData
                ? (() => {
                    const expiresAtValue: unknown = actionData.expiresAt;
                    if (expiresAtValue === null || expiresAtValue === undefined)
                      return undefined;
                    if (expiresAtValue instanceof Date)
                      return expiresAtValue.toISOString();
                    if (typeof expiresAtValue === "string")
                      return expiresAtValue;
                    return undefined;
                  })()
                : undefined,
            planName:
              "planName" in actionData ? actionData.planName : undefined,
            planId: "planId" in actionData ? actionData.planId : undefined,
            error: "error" in actionData ? actionData.error : undefined,
          }
        : null,
  });

  return (
    <>
      <div className="relative overflow-hidden bg-white dark:bg-gray-900 dark:text-gray-100">
        <div className="absolute left-0 right-0 top-0 flex h-64 opacity-70 dark:opacity-50">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white dark:to-gray-900" />
          <div className="grow bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900" />
          <div className="grow bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900 dark:to-teal-900" />
          <div className="grow bg-gradient-to-r from-teal-100 to-cyan-100 dark:from-teal-900 dark:to-cyan-900" />
          <div className="grow bg-gradient-to-r from-cyan-100 to-sky-100 dark:from-cyan-900 dark:to-sky-900" />
          <div className="grow bg-gradient-to-r from-sky-100 to-blue-100 dark:from-sky-900 dark:to-blue-900" />
          <div className="grow bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900" />
          <div className="grow bg-gradient-to-r from-indigo-100 to-violet-100 dark:from-violet-900 dark:to-violet-900" />
          <div className="grow bg-gradient-to-r from-violet-100 to-purple-100 dark:from-violet-900 dark:to-purple-900" />
          <div className="grow bg-gradient-to-r from-purple-100 to-fuchsia-100 dark:from-fuchsia-900 dark:to-fuchsia-900" />
          <div className="grow bg-gradient-to-r from-fuchsia-100 to-pink-100 dark:from-pink-900 dark:to-pink-900" />
          <div className="grow bg-gradient-to-r from-pink-100 to-rose-100 dark:from-pink-900 dark:to-rose-900" />
        </div>

        <Header />

        <div className="container relative mx-auto px-4 py-16 lg:px-8 lg:py-32 xl:max-w-7xl">
          <div className="mb-16 text-center">
            <div className="mb-2 inline-flex rounded border border-amber-300 bg-amber-200 px-2 py-1 text-sm font-medium leading-4 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/50 dark:text-amber-200">
              Choose the perfect plan for your needs!
            </div>
            <h1 className="mb-4 text-4xl font-black text-black dark:text-white">
              Pricing Plans
            </h1>
            <p className="mx-auto max-w-2xl text-xl font-medium leading-relaxed text-gray-700 dark:text-gray-300">
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
          actionData &&
          typeof actionData === "object" &&
          "message" in actionData
            ? String(actionData.message)
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
          actionData && typeof actionData === "object" && "error" in actionData
            ? String(actionData.error)
            : ""
        }
      />

      <Footer />
    </>
  );
}
