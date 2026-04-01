import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { applyUnsubscribeFromRawToken } from "~/features/broadcast/broadcast-unsubscribe.server";
import { buildSeoMeta, siteOriginFromMatches } from "~/lib/seo";

export const meta: MetaFunction = ({ matches }) =>
  buildSeoMeta(
    { page: "Unsubscribe", robots: "noindex, nofollow" },
    { siteOrigin: siteOriginFromMatches(matches) }
  );

/**
 * Public GET: no auth. Uses opaque token in <code>?t=</code>; response does not distinguish invalid vs valid tokens.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method !== "GET") {
    return json(
      {
        title: "Unable to process request",
        message: "This unsubscribe endpoint only supports GET requests.",
      },
      { status: 405 }
    );
  }
  const url = new URL(request.url);
  const t = url.searchParams.get("t");
  await applyUnsubscribeFromRawToken(t);
  return json(
    {
      title: "You're unsubscribed",
      message:
        "Unsubscribe successful. You will no longer receive broadcasts from this sender account.",
    },
    {
      status: 200,
      headers: {
        "X-Robots-Tag": "noindex, nofollow",
        "Cache-Control": "no-store",
      },
    }
  );
}

export default function BroadcastUnsubscribePage() {
  const data = useLoaderData<typeof loader>();
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center px-6 py-12">
      <section className="border-border bg-card w-full rounded-xl border p-6 shadow-sm">
        <h1 className="text-xl font-semibold">{data.title}</h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          {data.message}
        </p>
        <p className="text-muted-foreground mt-4 text-xs">
          You can close this page.
        </p>
      </section>
    </main>
  );
}
