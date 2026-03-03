import { useSearchParams } from "@remix-run/react";
import { useEffect } from "react";

import { useDeepLinkHandler } from "~/lib/deep-link-handler.client";

/**
 * Notification Handler Route
 * Handles deep links from push notifications
 */
export default function NotificationHandler() {
  const handleDeepLink = useDeepLinkHandler();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Extract notification data from URL params
    const postId = searchParams.get("postId");
    const publishAttemptId = searchParams.get("publishAttemptId");
    const action = searchParams.get("action") ?? "publish_success";

    if (postId) {
      handleDeepLink({
        postId,
        publishAttemptId: publishAttemptId ?? undefined,
        action: action as "publish_success" | "publish_failure",
      });
    } else {
      // No post ID, redirect to dashboard
      handleDeepLink({});
    }
  }, [handleDeepLink, searchParams]);

  return null;
}
