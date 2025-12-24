import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useNavigate,
} from "@remix-run/react";
import { Check, X, Loader2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";

import Footer from "~/components/layout/FrontendFooter";
import Header from "~/components/layout/FrontendHeader";
import { requireUser } from "~/features/auth/session.server";
import {
  createPlanInvoice,
  checkPaymentStatus,
  getUserSubscription,
  getAllPlans,
} from "~/models/payment.server";

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

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  // For payment polling, we don't need user authentication
  if (intent === "check_payment") {
    const paymentId = formData.get("paymentId") as string;

    if (!paymentId) {
      return json(
        { success: false, error: "Payment ID is required" },
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    try {
      const paymentStatus = await checkPaymentStatus(paymentId);

      if (paymentStatus.paid) {
        return json(
          {
            success: true,
            paid: true,
            paidAt: paymentStatus.paidAt,
            message: "Payment completed successfully!",
          },
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      return json(
        {
          success: true,
          paid: false,
          status: paymentStatus.status,
        },
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      // For payment polling, we want to return 200 with error info, not throw
      const errorResponse = await handleActionError(error);
      const errorData = await errorResponse.json();
      return json(
        {
          success: false,
          error: errorData.message || "Failed to check payment status",
        },
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }
  }

  // For other actions, require user authentication
  const user = await requireUser(request);

  if (intent === "select_plan") {
    const planId = formData.get("planId") as string;

    if (!planId) {
      return json({ error: "Plan ID is required" }, { status: 400 });
    }

    try {
      // Create invoice for the selected plan
      const invoice = await createPlanInvoice({
        planId,
        userId: user.id,
        description: `SmartFlow Social - Plan subscription`,
      });

      // For free plan, redirect immediately to dashboard
      if (invoice.invoice === "free_plan") {
        return redirect(
          "/dashboard?planActivated=true&message=" +
          encodeURIComponent("Free plan activated successfully!"),
        );
      }

      return json({
        success: true,
        invoice: invoice.invoice,
        paymentHash: invoice.paymentHash,
        amount: invoice.amount,
        amountUsd: invoice.amountUsd,
        paymentId: invoice.paymentId,
        expiresAt: invoice.expiresAt.toISOString(),
        planName: invoice.planName,
        planId: invoice.planId,
      });
    } catch (error) {
      console.error("Error creating plan invoice:", error);
      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to create payment invoice",
        },
        { status: 500 },
      );
    }
  }

  return json({ error: "Invalid intent" }, { status: 400 });
}

export const loader = async ({ request }: { request: Request }) => {
  // Get user if logged in (optional for viewing plans)
  let user = null;
  let currentSubscription = null;

  try {
    user = await requireUser(request);
    if (user) {
      currentSubscription = await getUserSubscription(user.id);
    }
  } catch {
    // User not logged in - that's okay for viewing plans
  }

  // Fetch plans from database
  const dbPlans = await getAllPlans();

  // Transform database plans to match the frontend format
  const plans = dbPlans.map((plan) => {
    const features = plan.features as any;
    const price = Number(plan.price);
    const period =
      price === 0
        ? ""
        : plan.enableLifetimeAccess
          ? "one payment"
          : "per month";

    return {
      id: plan.id,
      name: plan.name,
      price,
      period,
      description: plan.description || "",
      features: {
        basicScheduling: features.basicScheduling || plan.enableBasicScheduling,
        multipleQueues: features.multipleQueues || plan.enableMultipleQueues,
        bulkScheduling: features.bulkScheduling || plan.enableBulkScheduling,
        repostsAndQuotes:
          features.repostsAndQuotes || plan.enableRepostsAndQuotes,
        engagementFeed: features.engagementFeed || plan.enableEngagementFeed,
        giveaways: features.giveaways || plan.enableGiveaways,
        commissions:
          features.commissions || (plan.enableCommissions ? "Low" : "High"),
        leaderboards: features.leaderboards || plan.enableLeaderboards,
        advancedAnalytics:
          features.advancedAnalytics || plan.enableAdvancedAnalytics,
        multiAccountSwitching:
          features.multiAccountSwitching || plan.enableMultiAccountSwitching,
        wolfFilteringAndVortex:
          features.wolfFilteringAndVortex || plan.enableWolfFilteringAndVortex,
        nativeS3BlossomStorage:
          features.nativeS3BlossomStorage || plan.enableNativeS3BlossomStorage,
        relayBlast: features.relayBlast || plan.enableRelayBlast,
        visualPerks: features.visualPerks || plan.enableVisualPerks,
        lifetimeAccess: features.lifetimeAccess || plan.enableLifetimeAccess,
      },
      isPopular: plan.id === "basic", // You can make this dynamic based on your business logic
    };
  });

  return json({
    plans,
    user: user ? { id: user.id, isEnabled: user.isEnabled } : null,
    currentSubscription: currentSubscription
      ? {
        planId: currentSubscription.planId,
        status: currentSubscription.status,
        plan: currentSubscription.Plan?.name,
      }
      : null,
  });
};

export default function Plans() {
  const { plans, user, currentSubscription } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const shouldStopPolling = useRef(false);

  const isLoading = navigation.state === "submitting";

  // Handle action data (invoice creation or payment status)
  useEffect(() => {
    if (actionData?.success) {
      // Handle paid plan payment completion
      if (actionData.paid) {
        setPaymentComplete(true);
        setShowInvoice(false);
        setIsPolling(false);
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        // Redirect to dashboard after showing success message
        setTimeout(() => {
          navigate("/dashboard", { replace: true });
        }, 2000);
        return;
      }

      // Handle paid plan invoice creation
      if (actionData.invoice && actionData.invoice !== "free_plan") {
        setInvoiceData(actionData);
        setShowInvoice(true);
        // Set initial time remaining
        setTimeRemaining(new Date(actionData.expiresAt).getTime() - Date.now());
        // Start automatic payment status polling
        startPaymentPolling(actionData.paymentId);
      }
    }
  }, [actionData, navigate]);

  // Function to check payment status immediately
  const checkPaymentStatusNow = async (paymentId: string) => {
    try {
      const formData = new FormData();
      formData.append("paymentId", paymentId);

      const response = await fetch("/api/payment-status", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        return;
      }

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (_parseError) {
        return;
      }

      if (data.success && data.paid) {
        shouldStopPolling.current = true;
        setPaymentComplete(true);
        setShowInvoice(false);
        setIsPolling(false);
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }

        setTimeout(() => {
          navigate("/dashboard", { replace: true });
        }, 2000);
      }
    } catch (_error) {
      // Silently handle errors
    }
  };

  // Start automatic payment polling
  const startPaymentPolling = (paymentId: string) => {
    // Clear any existing interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }

    // Don't start if already polling or payment already complete
    if (isPolling) {
      return;
    }

    if (paymentComplete) {
      return;
    }

    // Reset the stopping ref
    shouldStopPolling.current = false;
    setIsPolling(true);
    const interval = setInterval(async () => {
      try {
        const formData = new FormData();
        formData.append("paymentId", paymentId);

        const response = await fetch("/api/payment-status", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          return;
        }

        const responseText = await response.text();
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (_parseError) {
          return;
        }

        if (data.success && data.paid) {
          // Stop this specific interval immediately
          clearInterval(interval);
          setPollingInterval(null);
          setIsPolling(false);
          shouldStopPolling.current = true;
          setPaymentComplete(true);
          setShowInvoice(false);

          // Also clear the stored interval reference to prevent any issues
          if (pollingInterval && pollingInterval !== interval) {
            clearInterval(pollingInterval);
          }

          // Redirect to dashboard after showing success message
          setTimeout(() => {
            navigate("/dashboard", { replace: true });
          }, 2000);
        }
      } catch (_error) {
        // Silently handle polling errors
      }
    }, 5000); // Poll every 5 seconds

    setPollingInterval(interval);

    // Stop polling after 5 minutes
    setTimeout(
      () => {
        shouldStopPolling.current = true;
        if (interval) {
          clearInterval(interval);
          setPollingInterval(null);
          setIsPolling(false);
        }
      },
      5 * 60 * 1000,
    );
  };

  // Clean up polling on component unmount
  useEffect(() => {
    return () => {
      shouldStopPolling.current = true;
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // Countdown timer effect
  useEffect(() => {
    if (showInvoice && invoiceData) {
      const timer = setInterval(() => {
        const remaining =
          new Date(invoiceData.expiresAt).getTime() - Date.now();
        setTimeRemaining(Math.max(0, remaining));

        if (remaining <= 0) {
          clearInterval(timer);
          shouldStopPolling.current = true;
          setShowInvoice(false);
          setIsPolling(false);
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [showInvoice, invoiceData, pollingInterval]);

  // Function to handle plan selection
  const handlePlanSelection = (
    event: React.MouseEvent<HTMLButtonElement>,
    planId: string,
  ) => {
    if (!user) {
      // Prevent form submission and redirect to login if not authenticated
      event.preventDefault();
      navigate("/login", { replace: true });
      return false;
    }
    setSelectedPlan(planId);
    return true;
  };

  // Function to copy invoice to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const featureLabels = [
    { key: "basicScheduling", label: "Basic scheduling" },
    { key: "multipleQueues", label: "Multiple queues" },
    { key: "bulkScheduling", label: "Bulk scheduling" },
    { key: "repostsAndQuotes", label: "Reposts & quotes" },
    { key: "engagementFeed", label: "Engagement Feed" },
    { key: "giveaways", label: "Giveaways" },
    { key: "commissions", label: "Commissions" },
    { key: "leaderboards", label: "Leaderboards" },
    { key: "advancedAnalytics", label: "Advanced analytics" },
    { key: "multiAccountSwitching", label: "Multi-account switching" },
    { key: "wolfFilteringAndVortex", label: "WoT filtering & Vertex relay" },
    { key: "nativeS3BlossomStorage", label: "Native SFS Blosstr storage" },
    { key: "relayBlast", label: "Relay blast" },
    { key: "visualPerks", label: "Visual Perks" },
    { key: "lifetimeAccess", label: "Lifetime Access" },
  ];

  const renderFeatureValue = (
    feature: { key: string; label: string },
    plan: (typeof plans)[0],
  ) => {
    const value = plan.features[feature.key as keyof typeof plan.features];

    if (typeof value === "boolean") {
      return value ? (
        <Check className="mx-auto h-5 w-5 text-green-500" />
      ) : (
        <X className="mx-auto h-5 w-5 text-gray-400" />
      );
    }

    if (typeof value === "string") {
      return <span className="px-2 text-center text-sm">{value}</span>;
    }

    return <span className="text-gray-400">-</span>;
  };

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
              <div
                key={plan.id}
                className={`relative rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800 ${plan.isPopular ? "ring-2 ring-green-500" : ""
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

                {currentSubscription?.planId === plan.id ? (
                  <div className="w-full rounded-lg bg-green-100 px-4 py-3 text-center font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                    Current Plan
                  </div>
                ) : (
                  <Form method="post">
                    <input type="hidden" name="intent" value="select_plan" />
                    <input type="hidden" name="planId" value={plan.id} />
                    <button
                      type="submit"
                      disabled={isLoading ? selectedPlan === plan.id : null}
                      onClick={(event) => handlePlanSelection(event, plan.id)}
                      className={`w-full rounded-lg px-4 py-3 font-medium transition-colors disabled:opacity-50 ${plan.isPopular
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
            ))}
          </div>

          {/* Feature Comparison Table */}
          <div className="overflow-hidden rounded-lg bg-white shadow-lg dark:bg-gray-800">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="p-4 text-left font-medium text-black dark:text-white">
                      Features
                    </th>
                    {plans.map((plan) => (
                      <th
                        key={plan.id}
                        className="p-4 text-center font-medium text-black dark:text-white"
                      >
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {featureLabels.map((feature, index) => (
                    <tr
                      key={feature.key}
                      className={`border-b border-gray-200 dark:border-gray-700 ${index % 2 === 0
                        ? "dark:bg-gray-750 bg-gray-50"
                        : "bg-white dark:bg-gray-800"
                        }`}
                    >
                      <td className="p-4 font-medium text-black dark:text-white">
                        {feature.label}
                      </td>
                      {plans.map((plan) => (
                        <td key={plan.id} className="p-4 text-center">
                          {renderFeatureValue(feature, plan)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

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
      {paymentComplete ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
          <div className="text-center">
            <Check className="mx-auto mb-4 h-12 w-12 text-green-500" />
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              Payment Successful!
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              {actionData?.message ||
                "Your plan has been activated successfully!"}
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Redirecting...
            </p>
          </div>
        </div>
      </div> : null}

      {/* Invoice Modal */}
      {showInvoice && invoiceData ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="mx-4 max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
          <div className="mb-4">
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              Complete Payment
            </h3>
            <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/30">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                Selected Plan: {invoiceData.planName}
              </p>
            </div>
          </div>

          <div className="mb-4">
            <div className="mb-2 flex justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>Amount:</span>
              <span className="font-medium">
                ${invoiceData.amountUsd} USD
              </span>
            </div>
            <div className="mb-2 flex justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>Lightning Amount:</span>
              <span className="font-medium">
                {invoiceData.amount.toLocaleString()} sats
              </span>
            </div>
            <div className="mb-4 flex justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>Expires:</span>
              <span className="font-medium">
                {new Date(invoiceData.expiresAt).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Lightning Invoice:
            </label>
            <div className="flex">
              <input
                type="text"
                value={invoiceData.invoice}
                readOnly
                className="min-w-0 flex-1 rounded-l-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              />
              <button
                onClick={() => copyToClipboard(invoiceData.invoice)}
                className="rounded-r-lg border border-l-0 border-gray-300 bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="mb-4 text-center">
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
              Scan QR code or copy the invoice to your Lightning wallet
            </p>
            {/* QR Code */}
            <div className="mb-4 flex justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(invoiceData.invoice)}`}
                alt="Lightning Invoice QR Code"
                className="rounded border border-gray-300 dark:border-gray-600"
              />
            </div>
            {isPolling ? <div className="flex items-center justify-center text-sm text-blue-600 dark:text-blue-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Waiting for payment...
            </div> : null}
          </div>

          <div className="text-center">
            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
              This window will automatically close when payment is received
            </p>
            <div className="text-xs text-gray-400 dark:text-gray-500">
              {timeRemaining > 0 ? (
                <>
                  Payment expires in {Math.floor(timeRemaining / (1000 * 60))}
                  :
                  {String(
                    Math.floor((timeRemaining % (1000 * 60)) / 1000),
                  ).padStart(2, "0")}
                </>
              ) : (
                <span className="text-red-500">Payment expired</span>
              )}
            </div>
          </div>
        </div>
      </div> : null}

      {/* Error Message */}
      {actionData?.error ? <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg bg-red-100 p-4 text-red-800 shadow-lg dark:bg-red-900 dark:text-red-200">
        <div className="flex">
          <X className="mr-2 h-5 w-5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">Error</p>
            <p className="text-sm">{actionData.error}</p>
          </div>
        </div>
      </div> : null}

      <Footer />
    </>
  );
}
