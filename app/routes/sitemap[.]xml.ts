import type { LoaderFunctionArgs } from "@remix-run/node";

import { absoluteUrl, getSiteOrigin } from "~/lib/site-url.server";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Minimal sitemap: public indexable routes only. */
export async function loader({ request }: LoaderFunctionArgs) {
  const origin = getSiteOrigin(request);
  const paths = ["/", "/plans"];
  const entries = paths
    .map(
      (path) =>
        `  <url><loc>${escapeXml(absoluteUrl(origin, path))}</loc></url>`
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
