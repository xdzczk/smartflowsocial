import type { LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { loadUploadProviderSettings } from "~/features/user";
import {
  withErrorHandling,
} from "~/lib/error-handler.server";

export const loader = withErrorHandling(
  async ({ request }: LoaderFunctionArgs) => {
    const userId = await requireUserId(request);
    return loadUploadProviderSettings(userId);
  },
);
