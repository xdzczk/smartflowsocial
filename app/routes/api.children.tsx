import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";
import {
  loadChildrenData,
  handleChildrenApiError,
} from "~/features/user/services/children-api.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    return loadChildrenData(userId);
  } catch (error) {
    return handleChildrenApiError(error, request.url);
  }
}
