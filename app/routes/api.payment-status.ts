import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

import { checkPaymentStatusById } from "~/features/payments";
import { withCSRFProtection } from "~/lib/csrf";
import { ValidationError } from "~/lib/errors";

type AssertFunction = (
  condition: boolean,
  message: string,
  context?: Record<string, unknown>
) => asserts condition;

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      const errorHandler = await import("~/lib/error-handler.server");
      const assert: AssertFunction = errorHandler.assert;

      assert(request.method === "POST", "Method not allowed", {
        method: request.method,
      });

      // Handle both JSON and FormData requests
      const contentType = request.headers.get("content-type") ?? "";
      let paymentId: string | null = null;

      if (contentType.includes("application/json")) {
        // Handle JSON request (from e2e tests)
        const body: unknown = await request.json().catch(() => null);
        if (!body || typeof body !== "object") {
          throw new ValidationError("Invalid JSON body", {
            contentType,
          });
        }
        // Type guard for body
        const bodyObj = body as Record<string, unknown>;
        paymentId =
          typeof bodyObj["paymentId"] === "string"
            ? bodyObj["paymentId"]
            : null;
      } else {
        // Handle FormData request (from actual app usage)
        try {
          const formData = await request.formData();
          paymentId = formData.get("paymentId") as string | null;
        } catch (error) {
          throw new ValidationError("Could not parse content as FormData", {
            contentType,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

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
  }
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
