import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";

import { buildSeoMeta, siteOriginFromMatches } from "~/lib/seo";

export const meta: MetaFunction = ({ matches }) =>
  buildSeoMeta(
    {
      page: "Login",
      description: "Log in to SmartFlowSocial.",
      robots: "noindex, nofollow",
    },
    { siteOrigin: siteOriginFromMatches(matches) }
  );

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
