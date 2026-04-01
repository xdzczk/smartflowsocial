// learn more: https://fly.io/docs/reference/configuration/#services-http_checks
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";

import { performHealthCheck, handleHealthCheckError } from "~/features/infra";
import { buildSeoMeta, siteOriginFromMatches } from "~/lib/seo";

export const meta: MetaFunction = ({ matches }) =>
  buildSeoMeta(
    { page: "Health", robots: "noindex, nofollow" },
    { siteOrigin: siteOriginFromMatches(matches) }
  );

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const host =
      request.headers.get("X-Forwarded-Host") ?? request.headers.get("host");

    return performHealthCheck(host);
  } catch (error) {
    return handleHealthCheckError(error, request.url);
  }
};
