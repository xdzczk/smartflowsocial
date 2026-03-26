import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const target = new URL("/dashboard/compose", url.origin);
  target.searchParams.set("type", "article");
  for (const [key, value] of url.searchParams.entries()) {
    if (key !== "type") {
      target.searchParams.append(key, value);
    }
  }
  return redirect(`${target.pathname}${target.search}`, 302);
}

export default function ComposeArticleCompatibility() {
  return null;
}
