import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { checkPaymentStatus } from "~/models/payment.server";
import { ValidationError, DatabaseError } from "~/lib/errors";
import {
  withActionErrorHandling,
  createSuccessResponse,
  assert,
} from "~/lib/error-handler.server";

export const action = withActionErrorHandling(
  async ({ request }: ActionFunctionArgs) => {
    assert(request.method === "POST", "Method not allowed", {
      method: request.method,
    });

    const formData = await request.formData();
    const paymentId = formData.get("paymentId") as string;

    assert(paymentId !== null && paymentId !== "", "Payment ID is required", {
      hasPaymentId: paymentId !== null,
    });

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
  },
);

// Handle GET requests with a proper error response
export async function loader() {
  return json(
    { success: false, error: "GET method not allowed. Use POST." },
    {
      status: 405,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}