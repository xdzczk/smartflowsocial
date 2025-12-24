import type { LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";
import {
  getUserUploadProvider,
  getUserEnableMirrorBlossom,
  getUserMirrorUploadUrls,
} from "~/models/user.server";
import { DatabaseError } from "~/lib/errors";
import {
  withErrorHandling,
} from "~/lib/error-handler.server";

export const loader = withErrorHandling(
  async ({ request }: LoaderFunctionArgs) => {
    const userId = await requireUserId(request);

    let provider, enableMirrorBlossom, mirrorUploadUrls;
    try {
      [provider, enableMirrorBlossom, mirrorUploadUrls] = await Promise.all([
        getUserUploadProvider(userId),
        getUserEnableMirrorBlossom(userId),
        getUserMirrorUploadUrls(userId),
      ]);
    } catch (error) {
      throw new DatabaseError("Failed to get upload provider settings", {
        userId,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      provider,
      enableMirrorBlossom,
      mirrorUploadUrls,
    };
  },
);
