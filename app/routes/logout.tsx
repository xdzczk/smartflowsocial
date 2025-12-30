import { redirect } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";

import { logout } from "~/features/auth";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    return await logout(request);
  } catch (error) {
    // For logout, errors are non-critical - just redirect
    const { logWarning } = await import("~/lib/error-logger.server");
    logWarning("Logout error (non-critical)", {
      error: error instanceof Error ? error.message : String(error),
    });
    return redirect("/");
  }
};

export const loader = async ({ request: _request }: LoaderFunctionArgs) => {
  try {
    return redirect("/");
  } catch (_error) {
    // For logout loader, errors are non-critical - just redirect
    return redirect("/");
  }
};
