/**
 * Payment status service layer
 * Handles payment status checking
 */

import { json } from "@remix-run/node";

import { DatabaseError } from "~/lib/errors";
import { checkPaymentStatus } from "~/models/payment.server";
/**
 * Check payment status by payment ID
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
}

