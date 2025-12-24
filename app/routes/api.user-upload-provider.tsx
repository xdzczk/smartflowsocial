import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";
import {
  getUserUploadProvider,
  getUserEnableMirrorBlossom,
  getUserMirrorUploadUrls,
} from "~/models/user.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const provider = await getUserUploadProvider(userId);
    const enableMirrorBlossom = await getUserEnableMirrorBlossom(userId);
    const mirrorUploadUrls = await getUserMirrorUploadUrls(userId);

    return json({
      provider,
      enableMirrorBlossom,
      mirrorUploadUrls,
    });
  } catch (error) {
    console.error("Get upload provider error:", error);
    return json({ error: "Failed to get upload provider" }, { status: 500 });
  }
}
