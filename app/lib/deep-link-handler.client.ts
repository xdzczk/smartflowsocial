/**
 * Deep Link Handler
 * Handles navigation from push notifications and other deep links
 */

import { useNavigate } from "@remix-run/react";

interface DeepLinkData {
  postId?: string;
  publishAttemptId?: string;
  action?: string;
  url?: string;
}

/**
 * Handle deep link navigation
 */
export function handleDeepLink(data: DeepLinkData): void {
  if (typeof window === "undefined") {
    return;
  }

  // If URL is provided, use it directly
  if (data.url) {
    window.location.href = data.url;
    return;
  }

  // Otherwise, construct URL from data
  if (data.postId) {
    if (data.action === "publish_failure") {
      window.location.href = `/dashboard/scheduled?postId=${data.postId}`;
    } else {
      window.location.href = `/dashboard/published?postId=${data.postId}`;
    }
  } else {
    // Default to dashboard
    window.location.href = "/dashboard";
  }
}

/**
 * React hook for handling deep links
 */
export function useDeepLinkHandler() {
  const navigate = useNavigate();

  return (data: DeepLinkData) => {
    if (data.url) {
      navigate(data.url);
      return;
    }

    if (data.postId) {
      if (data.action === "publish_failure") {
        navigate(`/dashboard/scheduled?postId=${data.postId}`);
      } else {
        navigate(`/dashboard/published?postId=${data.postId}`);
      }
    } else {
      navigate("/dashboard");
    }
  };
}
