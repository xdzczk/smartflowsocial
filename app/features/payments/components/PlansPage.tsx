import {
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "@remix-run/react";
import type { ReactNode } from "react";
import { useState } from "react";

import Footer from "~/components/layout/FrontendFooter";
import Header from "~/components/layout/FrontendHeader";
import {
  ErrorMessage,
  FeatureComparisonTable,
  InvoiceModal,
  PaymentSuccessModal,
  PricingCard,
  SubscriptionCheckoutModal,
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
  checkoutKind?: "lightning" | "btcpay";
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
    checkoutKind:
      "checkoutKind" in typedActionData &&
      (typedActionData["checkoutKind"] === "lightning" ||
        typedActionData["checkoutKind"] === "btcpay")
        ? typedActionData["checkoutKind"]
        : undefined,
    error:
      "error" in typedActionData && typeof typedActionData["error"] === "string"
        ? typedActionData["error"]
        : undefined,
  };
}

export function PlansPage(): ReactNode {
  const {
    plans,
    user,
    currentSubscription,
    nwc,
    subscriptionCheckoutV2Enabled,
    manualDurationsByCadence,
    btcpayFounderEnabled,
  } = useLoaderData<typeof plansLoader>();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Remix action data type is complex, validated at runtime
  const actionData = useActionData<typeof plansAction>();
  const navigation = useNavigation();
  const submit = useSubmit();

  type BillingCadence = "monthly" | "yearly";

  const isLoading = navigation.state === "submitting";
  const [nwcString, setNwcString] = useState("");
  const [billingCadence, setBillingCadence] =
    useState<BillingCadence>("monthly");
  const [manualDurationMonths, setManualDurationMonths] = useState(1);

  // Type guard for actionData
  const typedActionData =
    actionData && typeof actionData === "object" && !Array.isArray(actionData)
      ? (actionData as Record<string, unknown>)
      : null;

  const {
    showInvoice,
    showCheckout,
    invoiceData,
    paymentComplete,
    selectedPlan,
    timeRemaining,
    isPolling,
    btcpayAwaitingConfirmations,
    setSelectedPlan,
    handleOpenCheckout,
    handleCloseCheckout,
    copyToClipboard,
    checkPaymentStatusNow,
    handleCloseModal,
  } = usePlansState({
    user,
    actionData: parseActionData(typedActionData),
  });

  const selectedPlanObj = selectedPlan
    ? (plans.find((p) => p.id === selectedPlan) ?? null)
    : null;

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

          {/* Monthly / Yearly toggle */}
          <div className="mb-10 flex items-center justify-center">
            <div className="border-border bg-muted/30 inline-flex rounded-lg border p-1">
              <button
                type="button"
                onClick={() => setBillingCadence("monthly")}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  billingCadence === "monthly"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCadence("yearly")}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  billingCadence === "yearly"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Yearly
              </button>
            </div>
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
                useCheckoutModal={Boolean(subscriptionCheckoutV2Enabled)}
                billingCadence={billingCadence}
                onPlanSelect={(planId) => {
                  if (subscriptionCheckoutV2Enabled) {
                    handleOpenCheckout(planId);
                    return;
                  }
                  setSelectedPlan(planId);
                }}
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
          checkoutKind={invoiceData.checkoutKind}
          invoiceData={{
            invoice: invoiceData.invoice,
            amount: invoiceData.amount,
            amountUsd: invoiceData.amountUsd,
            expiresAt: invoiceData.expiresAt,
            paymentId: invoiceData.paymentId,
            contextLabel: invoiceData.contextLabel,
          }}
          timeRemaining={timeRemaining}
          isPolling={isPolling}
          btcpayAwaitingConfirmations={btcpayAwaitingConfirmations}
          onCopy={copyToClipboard}
          onCheckPayment={(id) => {
            void checkPaymentStatusNow(id);
          }}
          onClose={handleCloseModal}
        />
      ) : null}

      {/* Checkout Modal (dual lane) */}
      <SubscriptionCheckoutModal
        isOpen={subscriptionCheckoutV2Enabled ? showCheckout : false}
        plan={
          selectedPlanObj
            ? {
                id: selectedPlanObj.id,
                name: selectedPlanObj.name,
                price:
                  billingCadence === "yearly"
                    ? selectedPlanObj.yearlyPriceUsd
                    : selectedPlanObj.monthlyPriceUsd,
                period: billingCadence === "yearly" ? "per year" : "per month",
              }
            : null
        }
        isSubmitting={isLoading}
        billingCadence={billingCadence}
        manualDurations={manualDurationsByCadence[billingCadence]}
        selectedManualDurationMonths={
          billingCadence === "yearly" ? 12 : manualDurationMonths
        }
        onSelectedManualDurationMonthsChange={(months) => {
          setManualDurationMonths(months);
        }}
        nwcEnabled={Boolean(nwc?.enabled)}
        maskedNwcString={nwc?.maskedString}
        nwcString={nwcString}
        onNwcStringChange={setNwcString}
        onSelectManual={() => {
          if (!selectedPlanObj) return;
          const formData = new FormData();
          formData.set("intent", "select_plan");
          formData.set("planId", selectedPlanObj.id);
          formData.set("paymentMode", "manual");
          formData.set("billingCadence", billingCadence);
          formData.set(
            "accessDurationMonths",
            String(billingCadence === "yearly" ? 12 : manualDurationMonths)
          );
          submit(formData, { method: "post" });
          handleCloseCheckout();
        }}
        onSelectAutoRenew={() => {
          if (!selectedPlanObj) return;
          const formData = new FormData();
          formData.set("intent", "select_plan");
          formData.set("planId", selectedPlanObj.id);
          formData.set("paymentMode", "auto_renew");
          formData.set("billingCadence", billingCadence);
          formData.set(
            "accessDurationMonths",
            String(billingCadence === "yearly" ? 12 : 1)
          );
          if (nwcString.trim().length > 0) {
            formData.set("nwcString", nwcString.trim());
          }
          submit(formData, { method: "post" });
          handleCloseCheckout();
        }}
        onClose={handleCloseCheckout}
        btcpayFounderEnabled={btcpayFounderEnabled}
        onSelectBtcOnchain={() => {
          if (!selectedPlanObj || selectedPlanObj.id !== "founder") return;
          const formData = new FormData();
          formData.set("intent", "select_plan");
          formData.set("planId", selectedPlanObj.id);
          formData.set("paymentMode", "btc_onchain");
          formData.set("billingCadence", "monthly");
          formData.set("accessDurationMonths", "1");
          submit(formData, { method: "post" });
          handleCloseCheckout();
        }}
      />

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
