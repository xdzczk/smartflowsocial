import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { checkPaymentStatus } from "~/models/payment.server";

export async function action({ request }: ActionFunctionArgs) {

  if (request.method !== "POST") {
    return json(
      { success: false, error: "Method not allowed" },
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    const formData = await request.formData();
    const paymentId = formData.get("paymentId") as string;


    if (!paymentId) {
      return json(
        { success: false, error: "Payment ID is required" },
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

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
  } catch (error) {
    console.error("Error checking payment status:", error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to check payment status"
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}

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