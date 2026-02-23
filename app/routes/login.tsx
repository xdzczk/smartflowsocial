import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

/**
 * Legacy /login route: redirect to app root so login lives at app.smartflow.social.
 * Preserves query params (e.g. ?expectedPubkey= for account switcher).
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const search = url.search ? url.search : "";
  return redirect(`/${search}`, {
    status: 302,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
};
