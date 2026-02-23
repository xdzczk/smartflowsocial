import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

import { LoginPage, getUser } from "~/features/auth";

/**
 * App root: show login when not authenticated, redirect to dashboard when logged in.
 * Marketing landing lives at smartflow.social (static site).
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
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
    if (error instanceof Response) {
      return error;
    }
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {});
  }
};

export const meta = () => [{ title: "Login" }];

export default LoginPage;
