import {
  Link,
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSubmit,
} from "@remix-run/react";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";

import Footer from "~/components/layout/FrontendFooter";
import Header from "~/components/layout/FrontendHeader";
import {
  ErrorMessage,
  FeatureComparisonTable,
  InvoiceModal,
  PaymentSuccessModal,
  PricingCard,
  SubscriptionCheckoutModal,
  defaultCheckoutPaymentMethod,
  usePlansState,
} from "~/features/payments";
import { trackCheckoutEvent } from "~/features/payments/checkout/checkout-analytics.client";
import type { CheckoutPaymentMethodId } from "~/features/payments/checkout/checkout-method-config";
import { getAvailableCheckoutMethods } from "~/features/payments/checkout/checkout-method-config";
import { FounderCheckoutModal } from "~/features/payments/components/checkout/FounderCheckoutModal";
import { usePlansPageCheckoutAnalytics } from "~/features/payments/hooks/use-plans-page-checkout-analytics";
import type { PricingPagePlan } from "~/features/payments/types/plan-loader.types";
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

function clampCheckoutPaymentMethod(
  mainGridPlans: PricingPagePlan[],
  selectedPlanId: string | null,
  billingCadence: "monthly" | "yearly",
  btcpayYearlyOnChainEnabled: boolean,
  current: CheckoutPaymentMethodId
): CheckoutPaymentMethodId {
  if (selectedPlanId === "founder") {
    const available = getAvailableCheckoutMethods({
      planId: "founder",
      billingCadence: "yearly",
      btcpayYearlyOnChainEnabled: Boolean(btcpayYearlyOnChainEnabled),
      isLifetimePlan: true,
    });
    return available.includes(current)
      ? current
      : (available[0] ?? "lightning_one_time");
  }

  const p = selectedPlanId
    ? mainGridPlans.find((pl) => pl.id === selectedPlanId)
    : null;
  if (!p) return defaultCheckoutPaymentMethod();
  const available = getAvailableCheckoutMethods({
    planId: p.id,
    billingCadence,
    btcpayYearlyOnChainEnabled: Boolean(btcpayYearlyOnChainEnabled),
  });
  return available.includes(current)
    ? current
    : (available[0] ?? defaultCheckoutPaymentMethod());
}

/* eslint-disable sonarjs/cognitive-complexity -- Public pricing page: loader state, checkout modals, and large JSX layout */
export function PlansPage(): ReactNode {
  const {
    mainGridPlans,
    comparisonTablePlans,
    founderOffering,
    user,
    currentSubscription,
    nwc,
    subscriptionCheckoutV2Enabled,
    manualDurationsByCadence,
    btcpayYearlyOnChainEnabled,
  } = useLoaderData<typeof plansLoader>();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Remix action data type is complex, validated at runtime
  const actionData = useActionData<typeof plansAction>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const submit = useSubmit();

  type BillingCadence = "monthly" | "yearly";

  const isLoading = navigation.state === "submitting";
  const [nwcString, setNwcString] = useState("");
  const [billingCadence, setBillingCadence] =
    useState<BillingCadence>("monthly");
  const [manualDurationMonths, setManualDurationMonths] = useState(1);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] =
    useState<CheckoutPaymentMethodId>(defaultCheckoutPaymentMethod());

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
    resetPaymentActionGuard,
  } = usePlansState({
    user,
    actionData: parseActionData(typedActionData),
  });

  const selectedRecurringPlan =
    selectedPlan != null
      ? (mainGridPlans.find((p) => p.id === selectedPlan) ?? null)
      : null;

  const isFounderCheckout =
    Boolean(founderOffering) && selectedPlan === founderOffering?.id;

  const openCheckoutForPlan = useCallback(
    (planId: string) => {
      if (planId === "founder") {
        setCheckoutPaymentMethod(
          clampCheckoutPaymentMethod(
            mainGridPlans,
            "founder",
            "yearly",
            btcpayYearlyOnChainEnabled,
            "lightning_one_time"
          )
        );
      } else {
        setCheckoutPaymentMethod(
          clampCheckoutPaymentMethod(
            mainGridPlans,
            planId,
            billingCadence,
            btcpayYearlyOnChainEnabled,
            defaultCheckoutPaymentMethod()
          )
        );
      }
      handleOpenCheckout(planId);
    },
    [
      billingCadence,
      btcpayYearlyOnChainEnabled,
      handleOpenCheckout,
      mainGridPlans,
    ]
  );

  const checkoutPlanIdForAnalytics = selectedPlan;

  const closeCheckout = useCallback(() => {
    if (showCheckout && checkoutPlanIdForAnalytics) {
      trackCheckoutEvent("checkout_closed", {
        source: "plans_page",
        plan: checkoutPlanIdForAnalytics,
        cadence: billingCadence,
        method: checkoutPaymentMethod,
      });
      trackCheckoutEvent("payment_abandoned", {
        source: "plans_page",
        plan: checkoutPlanIdForAnalytics,
        cadence: billingCadence,
        method: checkoutPaymentMethod,
      });
    }
    setNwcString("");
    handleCloseCheckout();
  }, [
    billingCadence,
    checkoutPaymentMethod,
    checkoutPlanIdForAnalytics,
    handleCloseCheckout,
    showCheckout,
  ]);

  const closePaymentModal = useCallback(() => {
    trackCheckoutEvent("payment_modal_closed", {
      source: "plans_page",
      plan: invoiceData?.planId,
      cadence: billingCadence,
    });
    handleCloseModal();
  }, [billingCadence, handleCloseModal, invoiceData?.planId]);

  usePlansPageCheckoutAnalytics({
    billingCadence,
    checkoutPaymentMethod,
    manualDurationMonths,
    showCheckout,
    resetPaymentActionGuard,
    checkoutPlanIdForAnalytics,
    subscriptionCheckoutV2Enabled,
    isFounderCheckout,
    selectedRecurringPlan,
    showInvoice,
    invoiceData,
    paymentComplete,
    typedActionData,
  });

  const isFounderCurrent =
    currentSubscription?.planId === founderOffering?.id &&
    !currentSubscription?.isExpired;

  const lowSeatsThreshold = 5;
  const showLowSeatsWarning =
    founderOffering != null &&
    founderOffering.seatsRemaining > 0 &&
    founderOffering.seatsRemaining <= lowSeatsThreshold;

  return (
    <>
      <div className="bg-background relative min-h-screen overflow-hidden">
        <div className="from-secondary/20 to-background dark:from-background/20 absolute inset-0 bg-gradient-to-b via-transparent" />

        <Header />

        <div className="relative container mx-auto px-4 py-12 lg:px-8 lg:py-24 xl:max-w-7xl">
          {/* Hero copy alternatives considered:
              (A) H1: "Nostr-native infrastructure for publishing operations" /
                  Lead: "Plans for people running queues, campaigns, and relays - not dabbling."
              (B) H1: "Operator pricing for Nostr publishing" /
                  Lead: "Clear economics. Non-custodial Bitcoin and Lightning. Scale when you are ready." */}
          <div className="mb-8 text-center">
            <div className="border-border bg-muted text-muted-foreground mb-2.5 inline-flex rounded-full border px-4 py-2 text-sm font-medium">
              Nostr-native publishing infrastructure
            </div>
            <h1 className="text-foreground mb-3 text-4xl font-black tracking-tight">
              Pricing for operators running real workflows
            </h1>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg leading-relaxed font-medium md:text-xl">
              For solo publishers and multi-account operators: scheduling,
              campaigns, and distribution - paid in Bitcoin and Lightning,
              aligned with how you work on Nostr.
            </p>
          </div>

          <div className="mb-5 text-center">
            <p className="text-muted-foreground text-sm">
              Yearly billing is available for <strong>Creator</strong> and{" "}
              <strong>Pro</strong> (Founder is one-time only).
            </p>
          </div>

          <div className="mb-8 flex items-center justify-center">
            <div className="border-border bg-muted/30 inline-flex rounded-lg border p-1">
              <button
                type="button"
                onClick={() => {
                  setBillingCadence("monthly");
                  setCheckoutPaymentMethod((m) =>
                    clampCheckoutPaymentMethod(
                      mainGridPlans,
                      selectedPlan,
                      "monthly",
                      btcpayYearlyOnChainEnabled,
                      m
                    )
                  );
                }}
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
                onClick={() => {
                  setBillingCadence("yearly");
                  setCheckoutPaymentMethod((m) =>
                    clampCheckoutPaymentMethod(
                      mainGridPlans,
                      selectedPlan,
                      "yearly",
                      btcpayYearlyOnChainEnabled,
                      m
                    )
                  );
                }}
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

          <div className="mb-14 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {mainGridPlans.map((plan) => (
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
                    if (planId === "free") {
                      if (!user) {
                        navigate("/login", { replace: true });
                        return;
                      }
                      setSelectedPlan(planId);
                      const formData = new FormData();
                      formData.set("intent", "select_plan");
                      formData.set("planId", planId);
                      formData.set("paymentMode", "manual");
                      formData.set("billingCadence", "monthly");
                      formData.set("accessDurationMonths", "1");
                      submit(formData, { method: "post" });
                      return;
                    }
                    openCheckoutForPlan(planId);
                    return;
                  }
                  setSelectedPlan(planId);
                }}
              />
            ))}
          </div>

          {founderOffering ? (
            <section className="border-border from-card to-muted/30 mb-10 rounded-2xl border bg-gradient-to-br p-8 shadow-lg md:p-10">
              <p className="text-primary mb-3 text-xs font-semibold tracking-wider uppercase">
                Limited allocation - lifetime access
              </p>
              <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
                <div className="max-w-xl flex-1">
                  <h2 className="text-foreground mb-2 text-3xl font-bold tracking-tight">
                    {founderOffering.name}
                  </h2>
                  <p className="text-muted-foreground mb-5 text-sm leading-relaxed">
                    One-time purchase for permanent access to the top individual
                    workflow and infrastructure tier - no recurring bill.
                    Limited to {founderOffering.seatCap} seats in this
                    allocation; when they are gone, checkout closes.
                  </p>
                  <p className="text-foreground mb-6 text-4xl font-bold tabular-nums">
                    ${founderOffering.oneTimePriceUsd}{" "}
                    <span className="text-muted-foreground text-lg font-normal">
                      one-time
                    </span>
                  </p>
                  <div className="border-border bg-background/60 mb-6 rounded-lg border px-4 py-5">
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Seat status
                    </p>
                    <p className="text-foreground mt-1 text-4xl font-bold tracking-tight tabular-nums">
                      {founderOffering.seatsRemaining}{" "}
                      <span className="text-muted-foreground text-base font-semibold">
                        remaining
                      </span>
                    </p>
                    <p className="text-muted-foreground mt-2 text-sm tabular-nums">
                      {founderOffering.seatsClaimed} claimed ·{" "}
                      {founderOffering.seatCap} total
                    </p>
                    <div className="bg-muted/50 mt-4 h-2 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              (founderOffering.seatsClaimed /
                                founderOffering.seatCap) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                    {showLowSeatsWarning ? (
                      <p className="text-muted-foreground mt-3 text-xs">
                        {founderOffering.seatsRemaining} seats left in this
                        allocation.
                      </p>
                    ) : null}
                  </div>
                  <ul className="text-muted-foreground mb-6 space-y-2 text-sm">
                    {founderOffering.benefits.map((b) => (
                      <li key={b} className="flex gap-2">
                        <span className="text-primary shrink-0">✓</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Tied to one account owner. Product updates track the top
                    individual tier, including matching infrastructure access;
                    this is not Teams or a shared workspace - collaborative
                    Teams features are not included unless offered separately.
                  </p>
                </div>
                <div className="flex w-full shrink-0 flex-col gap-3 lg:w-72 lg:pt-1">
                  {isFounderCurrent ? (
                    <Link
                      to="/dashboard"
                      className="bg-secondary text-secondary-foreground hover:bg-secondary/90 flex items-center justify-center rounded-lg px-4 py-3 text-center text-sm font-medium"
                    >
                      You have Founder access
                    </Link>
                  ) : founderOffering.canPurchase ? (
                    <>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => {
                          if (!user) {
                            navigate("/login", { replace: true });
                            return;
                          }
                          openCheckoutForPlan(founderOffering.id);
                        }}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-3 text-sm font-medium disabled:opacity-50"
                      >
                        {isLoading && selectedPlan === founderOffering.id
                          ? "Processing…"
                          : "Claim Founder access"}
                      </button>
                      <p className="text-muted-foreground hidden text-xs lg:block">
                        One-time purchase · {founderOffering.seatCap} seats in
                        this allocation
                      </p>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="bg-muted text-muted-foreground cursor-not-allowed rounded-lg px-4 py-3 text-sm font-medium"
                    >
                      Sold out
                    </button>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          <div className="mb-10">
            <h2 className="text-foreground mb-3 text-center text-2xl font-bold">
              Compare plans
            </h2>
            <p className="text-muted-foreground mx-auto mb-6 max-w-3xl text-center text-sm leading-relaxed">
              Compare strict-cap Free, one-account Creator, and multi-account
              Pro, including workflow limits vs infrastructure access (e.g.
              Blossom-compatible hosted media, Blastr fanout). Founder is
              one-time, permanent top individual tier. Numbers reflect current
              limits.
            </p>
            <FeatureComparisonTable plans={comparisonTablePlans} />
          </div>

          {founderOffering ? (
            <div className="border-border bg-muted/30 mb-12 rounded-lg border p-6">
              <h3 className="text-foreground mb-2 text-lg font-semibold">
                Founder at a glance
              </h3>
              <p className="text-muted-foreground mb-3 text-sm">
                Short summary - see the Founder section above for full detail.
              </p>
              <ul className="text-muted-foreground list-inside list-disc space-y-1.5 text-sm">
                <li>
                  Permanent top individual workflow and infrastructure access
                </li>
                <li>Tied to one account owner</li>
                <li>
                  {founderOffering.seatCap} seats in this allocation - then
                  closed
                </li>
              </ul>
            </div>
          ) : null}

          <div className="mx-auto mb-14 max-w-3xl">
            <h2 className="text-foreground mb-2 text-center text-2xl font-bold">
              FAQ
            </h2>
            <p className="text-muted-foreground mx-auto mb-8 max-w-xl text-center text-sm">
              Practical answers - nothing here replaces the comparison table or
              checkout terms.
            </p>
            <dl className="space-y-8 text-sm">
              <div>
                <dt className="text-foreground text-base font-semibold">
                  How many accounts can I use on each plan?
                </dt>
                <dd className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
                  Free and Creator include one account on your subscription. Pro
                  includes up to three. Teams is separate: a future
                  collaborative workspace product, not the same as linking
                  multiple identities under Pro.
                </dd>
              </div>
              <div>
                <dt className="text-foreground text-base font-semibold">
                  What does lifetime Founder access include?
                </dt>
                <dd className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
                  Permanent access to the top individual tier with a single
                  payment - no subscription, including the same class of
                  infrastructure benefits as the top individual recurring tier
                  (hosted media and fanout distribution), subject to product
                  changes. Perks are listed in the Founder section above. This
                  is not Teams and does not grant shared workspace seats.
                </dd>
              </div>
              <div>
                <dt className="text-foreground text-base font-semibold">
                  Is Founder limited?
                </dt>
                <dd className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
                  Yes. One owner per purchase, non-recurring.
                  {founderOffering ? (
                    <>
                      {" "}
                      This allocation has {founderOffering.seatCap} seats; when
                      they are gone, Founder checkout closes.
                    </>
                  ) : (
                    <>
                      {" "}
                      It is sold in a fixed allocation; when seats are gone,
                      checkout closes.
                    </>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-foreground text-base font-semibold">
                  Can I change plans later?
                </dt>
                <dd className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
                  Move between Free, Creator, and Pro anytime. Founder stays a
                  separate one-time purchase while seats remain.
                </dd>
              </div>
              <div>
                <dt className="text-foreground text-base font-semibold">
                  Why is Teams not for sale?
                </dt>
                <dd className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
                  Shared workflows and roles need to ship complete. We are not
                  selling a placeholder - enrollment opens when the product is
                  ready.
                </dd>
              </div>
              <div>
                <dt className="text-foreground text-base font-semibold">
                  Can I pay yearly?
                </dt>
                <dd className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
                  Creator and Pro support yearly billing. Founder is one-time
                  only.
                </dd>
              </div>
              <div>
                <dt className="text-foreground text-base font-semibold">
                  What is hosted media?
                </dt>
                <dd className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
                  Creator and Pro include uploads on Blossom-compatible
                  SmartFlowSocial infrastructure - not just an app attachment
                  bucket. Media is Nostr-native and aligned with broader Nostr
                  media workflows (portability and mirroring where supported).
                  Storage and file-size limits vary by plan.
                </dd>
              </div>
              <div>
                <dt className="text-foreground text-base font-semibold">
                  What is Blastr fanout distribution?
                </dt>
                <dd className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
                  Pro includes access to SmartFlowSocial&apos;s Blastr fanout
                  relay distribution layer - stronger fanout-style relay
                  amplification for publishing, not merely &quot;more
                  relays&quot; in the UI. Reach depends on relay workflows and
                  setup; exact behavior varies by client and context where
                  supported.
                </dd>
              </div>
              <div>
                <dt className="text-foreground text-base font-semibold">
                  Can I use SmartFlow infrastructure outside the app?
                </dt>
                <dd className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
                  Hosted media is built on Blossom-compatible infrastructure;
                  distribution uses SmartFlowSocial fanout relay infrastructure.
                  Some of this can support compatible Nostr setups beyond the
                  core app, but interoperability is not universal - what works
                  depends on the client, configuration, and supported flows.
                </dd>
              </div>
              <div>
                <dt className="text-foreground text-base font-semibold">
                  Do I need a wallet connection?
                </dt>
                <dd className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
                  Lightning and on-chain checkout work without NWC. Add Nostr
                  Wallet Connect when you want auto-renew and smoother
                  wallet-driven flows on recurring plans.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

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

      <FounderCheckoutModal
        isOpen={Boolean(
          subscriptionCheckoutV2Enabled && showCheckout && isFounderCheckout
        )}
        plan={
          founderOffering
            ? {
                id: founderOffering.id,
                name: founderOffering.name,
                oneTimePriceUsd: founderOffering.oneTimePriceUsd,
                checkoutPricing: founderOffering.checkoutPricing,
              }
            : null
        }
        isSubmitting={isLoading}
        btcpayYearlyOnChainEnabled={btcpayYearlyOnChainEnabled}
        onSelectManual={() => {
          if (!founderOffering) return;
          const formData = new FormData();
          formData.set("intent", "select_plan");
          formData.set("planId", founderOffering.id);
          formData.set("paymentMode", "manual");
          formData.set("billingCadence", "yearly");
          formData.set("accessDurationMonths", "12");
          submit(formData, { method: "post" });
          closeCheckout();
        }}
        onSelectBtcOnchain={() => {
          if (!founderOffering) return;
          trackCheckoutEvent("btcpay_redirect_started", {
            source: "plans_page",
            plan: founderOffering.id,
            cadence: "yearly",
            method: "btc_onchain",
          });
          const formData = new FormData();
          formData.set("intent", "select_plan");
          formData.set("planId", founderOffering.id);
          formData.set("paymentMode", "btc_onchain");
          formData.set("billingCadence", "yearly");
          formData.set("accessDurationMonths", "12");
          submit(formData, { method: "post" });
          closeCheckout();
        }}
        onClose={closeCheckout}
        paymentMethod={checkoutPaymentMethod}
        onPaymentMethodChange={(m) => {
          setCheckoutPaymentMethod(
            clampCheckoutPaymentMethod(
              mainGridPlans,
              "founder",
              "yearly",
              btcpayYearlyOnChainEnabled,
              m
            )
          );
        }}
      />

      <SubscriptionCheckoutModal
        isOpen={Boolean(
          subscriptionCheckoutV2Enabled &&
          showCheckout &&
          selectedRecurringPlan != null &&
          !isFounderCheckout
        )}
        plan={
          selectedRecurringPlan
            ? {
                id: selectedRecurringPlan.id,
                name: selectedRecurringPlan.name,
                price:
                  billingCadence === "yearly"
                    ? selectedRecurringPlan.yearlyPriceUsd
                    : selectedRecurringPlan.monthlyPriceUsd,
                period: billingCadence === "yearly" ? "per year" : "per month",
                checkoutPricing: selectedRecurringPlan.checkoutPricing,
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
          if (!selectedRecurringPlan) return;
          const formData = new FormData();
          formData.set("intent", "select_plan");
          formData.set("planId", selectedRecurringPlan.id);
          formData.set("paymentMode", "manual");
          formData.set("billingCadence", billingCadence);
          formData.set(
            "accessDurationMonths",
            String(billingCadence === "yearly" ? 12 : manualDurationMonths)
          );
          submit(formData, { method: "post" });
          closeCheckout();
        }}
        onSelectAutoRenew={() => {
          if (!selectedRecurringPlan) return;
          const formData = new FormData();
          formData.set("intent", "select_plan");
          formData.set("planId", selectedRecurringPlan.id);
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
          closeCheckout();
        }}
        onClose={closeCheckout}
        btcpayYearlyOnChainEnabled={btcpayYearlyOnChainEnabled}
        onSelectBtcOnchain={() => {
          if (!selectedRecurringPlan || selectedRecurringPlan.id === "free")
            return;
          trackCheckoutEvent("btcpay_redirect_started", {
            source: "plans_page",
            plan: selectedRecurringPlan.id,
            cadence: "yearly",
            method: "btc_onchain",
          });
          const formData = new FormData();
          formData.set("intent", "select_plan");
          formData.set("planId", selectedRecurringPlan.id);
          formData.set("paymentMode", "btc_onchain");
          formData.set("billingCadence", "yearly");
          formData.set("accessDurationMonths", "12");
          submit(formData, { method: "post" });
          closeCheckout();
        }}
        paymentMethod={checkoutPaymentMethod}
        onPaymentMethodChange={setCheckoutPaymentMethod}
      />

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
          onClose={closePaymentModal}
        />
      ) : null}

      <ErrorMessage
        message={
          typedActionData && "error" in typedActionData
            ? typeof typedActionData["error"] === "string"
              ? typedActionData["error"]
              : String(typedActionData["error"])
            : ""
        }
      />

      <div className="mt-14">
        <Footer />
      </div>
    </>
  );
}
/* eslint-enable sonarjs/cognitive-complexity */

export default PlansPage;
