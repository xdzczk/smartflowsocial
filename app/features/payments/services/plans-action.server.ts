/**
 * Plans action handlers
 * Centralized action processing for plans page
 */

import { requireUser } from "~/features/auth/session.server";
import { logError } from "~/lib/error-logger.server";
import {
  plansActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import { checkPaymentStatus, createPlanInvoice } from "~/models/payment.server";

export async function handlePlansAction(formData: FormData, request: Request) {
  const result = validateFormDataOrRespond(formData, plansActionSchema);
  if (!result.success) {
    return result.response;
  }

  const { intent } = result.data;

  // For payment polling, we don't need user authentication
  if (intent === "check_payment") {
    const checkData = result.data.intent === "check_payment" ? result.data : null;
    if (!checkData) {
      return {
        success: false,
        error: "Invalid intent",
      };
    }

    try {
      const paymentStatus = await checkPaymentStatus(checkData.paymentId);

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
      const errorResponse = handleActionError(error);
      const errorData: unknown =
        errorResponse instanceof Response ? await errorResponse.json() : null;
      const errorMessage =
        errorData &&
        typeof errorData === "object" &&
        !Array.isArray(errorData) &&
        "message" in errorData &&
        typeof (errorData as { message?: unknown }).message === "string"
          ? (errorData as { message: string }).message
          : "Failed to check payment status";
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // For other actions, require user authentication
  const user = await requireUser(request);

  if (intent === "select_plan") {
    const selectData = result.data.intent === "select_plan" ? result.data : null;
    if (!selectData) {
      return { error: "Invalid intent" };
    }

    try {
      // Create invoice for the selected plan
      const invoice = await createPlanInvoice({
        planId: selectData.planId,
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
      logError(error instanceof Error ? error : new Error(String(error)), {
        userId: user.id,
        planId: selectData.planId,
        message: "Error creating plan invoice",
      });
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
