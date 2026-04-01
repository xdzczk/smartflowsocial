import { redirect } from "@remix-run/node";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";

import { logout } from "~/features/auth";
import { withCSRFProtection } from "~/lib/csrf";
import { buildSeoMeta, siteOriginFromMatches } from "~/lib/seo";

export const meta: MetaFunction = ({ matches }) =>
  buildSeoMeta(
    { page: "Logout", robots: "noindex, nofollow" },
    { siteOrigin: siteOriginFromMatches(matches) }
  );

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
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
  }
);

export const loader = async ({ request: _request }: LoaderFunctionArgs) => {
  try {
    return redirect("/");
  } catch (_error) {
    // For logout loader, errors are non-critical - just redirect
    return redirect("/");
  }
};
