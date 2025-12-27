import type { LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";
import {
  loadParentData,
  handleParentApiError,
} from "~/features/user";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    return loadParentData(userId);
  } catch (error) {
    return handleParentApiError(error, request.url);
  }
}

