import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

import { LoginPage, getUserId } from "~/features/auth";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const userId = await getUserId(request);
    if (userId) return redirect("/dashboard");
    return json({});
  } catch (error) {
    // For login page, errors are non-critical - just return empty data
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {});
  }
};

export const meta = () => [{ title: "Login" }];

export default LoginPage;
