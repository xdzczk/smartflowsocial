import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

import { LoginPage, getUser } from "~/features/auth";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Use getUser instead of getUserId to ensure session is actually valid
    // getUser will return null for invalid/expired sessions, and will throw/logout for invalid legacy sessions
    const user = await getUser(request);
    if (user) {
      return redirect("/dashboard", {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }
    return json(
      {},
      {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    // If error is a Response (e.g., redirect from logout), return it directly
    if (error instanceof Response) {
      return error;
    }
    // If getUser throws (e.g., invalid legacy session), it will have already called logout
    // For login page, errors are non-critical - just return empty data
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {});
  }
};

export const meta = () => [{ title: "Login" }];

export default LoginPage;
