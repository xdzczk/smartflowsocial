/**
 * Plans action handlers
 * Centralized action processing for plans page
 */

import { requireUser } from "~/features/auth/session.server";
import {
  createPlanInvoice,
  checkPaymentStatus,
} from "~/models/payment.server";

export async function handlePlansAction(
  formData: FormData,
  request: Request,
) {
  const intent = formData.get("intent");

  // For payment polling, we don't need user authentication
  if (intent === "check_payment") {
    const paymentId = formData.get("paymentId") as string;

    if (!paymentId) {
      return {
        success: false,
        error: "Payment ID is required",
      };
    }

    try {
      const paymentStatus = await checkPaymentStatus(paymentId);

      if (paymentStatus.paid) {
        return {
          success: true,
          paid: true,
          paidAt: paymentStatus.paidAt,
          message: "Payment completed successfully!",
        };
      }

      return {
        success: true,
        paid: false,
        status: paymentStatus.status,
      };
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      // For payment polling, we want to return error info, not throw
      const errorResponse = await handleActionError(error);
      const errorData = await errorResponse.json();
      return {
        success: false,
        error: errorData.message || "Failed to check payment status",
      };
    }
  }

  // For other actions, require user authentication
  const user = await requireUser(request);

  if (intent === "select_plan") {
    const planId = formData.get("planId") as string;

    if (!planId) {
      return { error: "Plan ID is required" };
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
        return {
          redirect:
            "/dashboard?planActivated=true&message=" +
            encodeURIComponent("Free plan activated successfully!"),
        };
      }

      return {
        success: true,
        invoice: invoice.invoice,
        paymentHash: invoice.paymentHash,
        amount: invoice.amount,
        amountUsd: invoice.amountUsd,
        paymentId: invoice.paymentId,
        expiresAt: invoice.expiresAt.toISOString(),
        planName: invoice.planName,
        planId: invoice.planId,
      };
    } catch (error) {
      console.error("Error creating plan invoice:", error);
      return {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create payment invoice",
      };
    }
  }

  return { error: "Invalid intent" };
}


