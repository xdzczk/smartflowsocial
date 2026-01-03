import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

import { checkPaymentStatusById } from "~/features/payments";
import { withCSRFProtection } from "~/lib/csrf";

type AssertFunction = (
  condition: boolean,
  message: string,
  context?: Record<string, unknown>,
) => asserts condition;

export const action = withCSRFProtection(async ({ request }: ActionFunctionArgs) => {
  try {
    const errorHandler = await import("~/lib/error-handler.server");
    const assert: AssertFunction = errorHandler.assert;

    assert(request.method === "POST", "Method not allowed", {
      method: request.method,
    });

    const formData = await request.formData();
    const paymentId = formData.get("paymentId") as string;

    assert(paymentId !== null && paymentId !== "", "Payment ID is required", {
      hasPaymentId: paymentId !== null,
    });

    return await checkPaymentStatusById(paymentId);
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
});

// Handle GET requests with a proper error response
export async function loader() {
  return json(
    { success: false, error: "GET method not allowed. Use POST." },
    {
      status: 405,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}
