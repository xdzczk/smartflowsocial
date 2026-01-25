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

  if (!query || query.trim() === "") {
    return json({ results: [], total: 0 });
  }

  const results = await performGlobalSearch(userId, query, 5);
  return json(results);
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const queryValue = formData.get("q");
  const query = typeof queryValue === "string" ? queryValue : "";

  if (!query || query.trim() === "") {
    return json({ results: [], total: 0 });
  }

  const results = await performGlobalSearch(userId, query, 5);
  return json(results);
}
