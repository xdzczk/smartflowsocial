/**
 * Payment status service layer
 * Handles payment status checking
 */

import { json } from "@remix-run/node";

import {
  checkPaymentStatus,
  getPaymentUserId,
  manuallyVerifyPayment,
} from "~/features/payments/data";
import { DatabaseError } from "~/lib/errors";

export { getPaymentUserId };
/**
 * Check payment status by payment ID
 * Automatically attempts to verify payment if still PENDING
 * (handles cases where onPaid callback didn't fire, e.g., self-payments)
 */
export async function checkPaymentStatusById(paymentId: string) {
  let paymentStatus;

  try {
    paymentStatus = await checkPaymentStatus(paymentId);
  } catch (error) {
    throw new DatabaseError("Failed to check payment status", {
      paymentId,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }

  // If payment is still PENDING, try to manually verify it
  // This handles cases where the payment was received but onPaid callback didn't fire
  if (!paymentStatus.paid && paymentStatus.status === "PENDING") {
    try {
      const verification = await manuallyVerifyPayment(paymentId);
      if (verification.success && verification.paid) {
        // Re-check status after manual verification
        paymentStatus = await checkPaymentStatus(paymentId);
      }
    } catch (_error) {
      // If manual verification fails, continue with original status
      // This is expected if payment truly hasn't been received
    }
  }

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
      }
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
    }
  );
}
