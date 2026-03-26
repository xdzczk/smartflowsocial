import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  return redirect(`/dashboard/compose${url.search}`, 302);
}

export default function ComposeIndexCompatibility() {
  return null;
}
