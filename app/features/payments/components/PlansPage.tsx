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

  const founderHighlights = [
    "Permanent access to the top individual tier",
    "Hosted media and fanout access included",
    "Priority support",
    "Early access to major features",
    "Founder recognition in product",
  ];

  return (
    <>
      <div className="bg-canvas relative min-h-screen overflow-hidden">
        <div className="from-surface-hover/25 via-canvas to-canvas dark:from-canvas/30 absolute inset-0 bg-gradient-to-b" />

        <Header />

        <div className="relative container mx-auto px-4 py-8 lg:px-8 lg:py-12 xl:max-w-7xl">
          {/* Hero copy alternatives considered:
              (A) H1: "Nostr-native infrastructure for publishing operations" /
                  Lead: "Plans for people running queues, campaigns, and relays - not dabbling."
              (B) H1: "Operator pricing for Nostr publishing" /
                  Lead: "Clear economics. Non-custodial Bitcoin and Lightning. Scale when you are ready." */}
          <div className="mx-auto mb-5 max-w-3xl text-center">
            <div className="border-border bg-surface-hover/70 text-text-secondary mb-2 inline-flex rounded-full border px-3.5 py-1.5 text-xs font-medium tracking-wide">
              Nostr-native publishing infrastructure
            </div>
            <h1 className="text-text mb-2 text-4xl font-extrabold tracking-[-0.02em] sm:text-5xl sm:leading-[1.06]">
              Simple pricing for serious Nostr publishing
            </h1>
            <p className="text-text-secondary/90 mx-auto max-w-2xl text-base leading-relaxed font-medium sm:text-lg">
              Start free, then upgrade when you need more accounts, more
              workflow capacity, and hosted infrastructure.
            </p>
            <p className="text-text-secondary mt-3 text-sm">
              Yearly billing is available for Starter, Creator, and Pro at the
              equivalent of 10 months.
            </p>
          </div>

          <div className="mb-7 flex items-center justify-center">
            <div className="border-border bg-canvas/75 shadow-1 inline-flex rounded-xl border p-1 backdrop-blur">
              <button
                type="button"
                aria-pressed={billingCadence === "monthly"}
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
                className={`focus-ring motion-fast rounded-lg px-4 py-2 text-sm font-medium ${
                  billingCadence === "monthly"
                    ? "bg-surface text-text shadow-1"
                    : "text-text-secondary hover:bg-surface-hover/60 hover:text-text"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                aria-pressed={billingCadence === "yearly"}
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
                className={`focus-ring motion-fast rounded-lg px-4 py-2 text-sm font-medium ${
                  billingCadence === "yearly"
                    ? "bg-surface text-text shadow-1"
                    : "text-text-secondary hover:bg-surface-hover/60 hover:text-text"
                }`}
              >
                Yearly
              </button>
            </div>
          </div>

          <div className="mb-9 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
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
            <section className="border-border from-surface via-surface to-surface-hover/20 shadow-2 mb-7 rounded-xl border bg-gradient-to-r p-4 md:p-5">
              <p className="text-link text-[11px] font-semibold tracking-[0.14em] uppercase">
                LIMITED ALLOCATION — LIFETIME ACCESS
              </p>
              <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-12 lg:items-start lg:gap-5">
                <div className="md:col-span-1 lg:col-span-4">
                  <h2 className="text-text text-2xl font-bold tracking-tight md:text-[1.9rem]">
                    Founder
                  </h2>
                  <p className="text-text-secondary mt-1.5 text-sm leading-relaxed">
                    One-time purchase for permanent access to the top individual
                    tier. Limited to 21 seats.
                  </p>
                  <p className="text-text mt-3 text-3xl font-bold tabular-nums">
                    ${founderOffering.oneTimePriceUsd}{" "}
                    <span className="text-text-secondary text-base font-medium">
                      one-time
                    </span>
                  </p>
                </div>

                <div className="md:col-span-1 lg:col-span-5">
                  <ul className="text-text-secondary space-y-1.5 text-sm">
                    {founderHighlights.map((benefit) => (
                      <li key={benefit} className="flex items-start gap-2">
                        <span className="text-link mt-0.5 shrink-0 text-xs">
                          ✓
                        </span>
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-text-secondary/80 mt-2.5 text-xs">
                    Tied to one account owner. Not a shared workspace seat.
                  </p>
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <div className="flex w-full flex-col gap-2">
                    {isFounderCurrent ? (
                      <Link
                        to="/dashboard"
                        className="focus-ring bg-surface-hover text-text hover:bg-surface-active motion-fast flex items-center justify-center rounded-lg px-4 py-3 text-center text-sm font-medium"
                      >
                        You have Founder access
                      </Link>
                    ) : founderOffering.canPurchase ? (
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
                        className="focus-ring-offset bg-action-primary text-action-primary-foreground hover:bg-action-primary/90 motion-fast rounded-lg px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        {isLoading && selectedPlan === founderOffering.id
                          ? "Processing…"
                          : "Claim Founder access"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="bg-surface-hover text-text-secondary cursor-not-allowed rounded-lg px-4 py-3 text-sm font-medium"
                      >
                        Sold out
                      </button>
                    )}

                    <div className="border-border bg-canvas/70 rounded-lg border px-3 py-2.5">
                      <p className="text-text text-sm font-semibold tabular-nums">
                        {founderOffering.seatsRemaining} seats remaining
                      </p>
                      <p className="text-text-secondary mt-0.5 text-xs tabular-nums">
                        {founderOffering.seatsClaimed} claimed ·{" "}
                        {founderOffering.seatCap} total
                      </p>
                    </div>

                    <p className="text-text-secondary text-xs">
                      One-time purchase
                    </p>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <div className="mb-7">
            <h2 className="text-text mb-2 text-center text-2xl font-bold tracking-tight">
              Compare plans
            </h2>
            <p className="text-text-secondary mx-auto mb-4 max-w-3xl text-center text-sm leading-relaxed">
              Compare strict-cap Free, Starter, Creator, and Pro, including
              workflow limits vs infrastructure access (e.g. Blossom-compatible
              hosted media and Blastr fanout). Founder is one-time, permanent
              top individual tier.
            </p>
            <FeatureComparisonTable plans={comparisonTablePlans} />
          </div>

          <div className="mx-auto mb-8 max-w-2xl">
            <h2 className="text-text mb-1.5 text-center text-2xl font-bold tracking-tight">
              FAQ
            </h2>
            <p className="text-text-secondary mx-auto mb-4 max-w-xl text-center text-sm leading-relaxed">
              Practical answers. This section does not replace the comparison
              table or checkout terms.
            </p>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-text text-base font-semibold">
                  How many accounts can I use on each plan?
                </dt>
                <dd className="text-text-secondary mt-1.5 text-sm leading-relaxed">
                  Free and Starter include one account. Creator includes up to
                  two. Pro includes up to five.
                </dd>
              </div>
              <div>
                <dt className="text-text text-base font-semibold">
                  Can I change plans later?
                </dt>
                <dd className="text-text-secondary mt-1.5 text-sm leading-relaxed">
                  Yes. Move between Free, Starter, Creator, and Pro anytime.
                  Founder remains a separate one-time purchase while seats
                  remain.
                </dd>
              </div>
              <div>
                <dt className="text-text text-base font-semibold">
                  Can I pay yearly?
                </dt>
                <dd className="text-text-secondary mt-1.5 text-sm leading-relaxed">
                  Yes. Starter, Creator, and Pro support yearly billing at the
                  equivalent of 10 months. Founder is one-time only.
                </dd>
              </div>
              <div>
                <dt className="text-text text-base font-semibold">
                  What is hosted media?
                </dt>
                <dd className="text-text-secondary mt-1.5 text-sm leading-relaxed">
                  Starter, Creator, and Pro include uploads on
                  SmartFlowSocial&apos;s Blossom-compatible media
                  infrastructure. Storage and file-size limits vary by plan.
                </dd>
              </div>
              <div>
                <dt className="text-text text-base font-semibold">
                  What is Blastr fanout distribution?
                </dt>
                <dd className="text-text-secondary mt-1.5 text-sm leading-relaxed">
                  Pro includes access to SmartFlowSocial&apos;s Blastr fanout
                  relay distribution layer for stronger publishing distribution
                  where supported.
                </dd>
              </div>
              <div>
                <dt className="text-text text-base font-semibold">
                  Do I need a wallet connection?
                </dt>
                <dd className="text-text-secondary mt-1.5 text-sm leading-relaxed">
                  No. Lightning and on-chain checkout work without NWC. Add
                  Nostr Wallet Connect later if you want smoother recurring
                  wallet-driven flows.
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

      <div className="mt-10 sm:mt-12">
        <Footer />
      </div>
    </>
  );
}
/* eslint-enable sonarjs/cognitive-complexity */

export default PlansPage;
