import type { LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import {
  loadChildrenData,
  handleChildrenApiError,
} from "~/features/user";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    return loadChildrenData(userId);
  } catch (error) {
    return handleChildrenApiError(error, request.url);
  }
}
