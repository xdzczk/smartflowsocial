import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { performGlobalSearch } from "~/features/search";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const trimmedQuery = query.trim();
  const context = url.searchParams.get("context") ?? undefined;

  // Require at least 2 characters to search (matches client-side requirement)
  if (!trimmedQuery || trimmedQuery.length < 2) {
    return json({ results: [], total: 0 });
  }

  const results = await performGlobalSearch(userId, trimmedQuery, 5, context);
  return json(results);
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const queryValue = formData.get("q");
  const query = typeof queryValue === "string" ? queryValue : "";
  const trimmedQuery = query.trim();

  // Require at least 2 characters to search (matches client-side requirement)
  if (!trimmedQuery || trimmedQuery.length < 2) {
    return json({ results: [], total: 0 });
  }

  const context =
    typeof formData.get("context") === "string"
      ? (formData.get("context") as string)
      : undefined;
  const results = await performGlobalSearch(userId, trimmedQuery, 5, context);
  return json(results);
}
