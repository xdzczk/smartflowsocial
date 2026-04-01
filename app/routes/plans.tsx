import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";

import {
  PlansPage,
  handlePlansAction,
  loadPlansData,
} from "~/features/payments";
import { withCSRFProtection } from "~/lib/csrf";
import {
  buildSeoMeta,
  SEO_PLANS_DESCRIPTION,
  siteOriginFromMatches,
} from "~/lib/seo";

export const meta: MetaFunction = ({ matches }) => {
  const siteOrigin = siteOriginFromMatches(matches);
  return buildSeoMeta(
    {
      page: "Pricing",
      description: SEO_PLANS_DESCRIPTION,
      robots: "index, follow",
      canonicalPath: "/plans",
      ogType: "website",
      includeAuthor: true,
    },
    { siteOrigin }
  );
};

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    const formData = await request.formData();
    const result = await handlePlansAction(formData, request);

    // Type narrowing: check if result is a Response
    if (result instanceof Response) {
      return result;
    }

    // Type narrowing: check if result has redirect property

    /* eslint-disable @typescript-eslint/no-unnecessary-condition -- Runtime type guard for Remix serialized data */
    if (
      typeof result === "object" &&
      result !== null &&
      "redirect" in result &&
      result.redirect
    ) {
      /* eslint-enable @typescript-eslint/no-unnecessary-condition */
      return redirect(result.redirect);
    }

    // Type narrowing: check if result has error property

    /* eslint-disable @typescript-eslint/no-unnecessary-condition -- Runtime type guard for Remix serialized data */
    if (
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      result.error
    ) {
      /* eslint-enable @typescript-eslint/no-unnecessary-condition */
      const status =
        "status" in result && typeof result.status === "number"
          ? result.status
          : 400;
      return json(result, { status });
    }

    return json(result);
  }
);

export const loader = async ({ request }: { request: Request }) => {
  const data = await loadPlansData(request);
  return json(data);
};

export default PlansPage;
