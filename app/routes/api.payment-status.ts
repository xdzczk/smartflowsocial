import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { checkPaymentStatusById } from "~/features/payments/services/payment-status.server";
import { ValidationError } from "~/lib/errors";
import {
  withActionErrorHandling,
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

    return checkPaymentStatusById(paymentId);
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