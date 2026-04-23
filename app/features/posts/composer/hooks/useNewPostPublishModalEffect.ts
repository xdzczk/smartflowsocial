import type { QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { scheduleRefreshPostViews } from "~/features/posts/hooks/useRefreshPostViews";

interface ModalPostShape {
  id: string;
  publishAttemptId: string | null;
  currentState?: string | null;
  scheduledAtUtc?: string | Date | null;
}

interface FetchPostsResponse {
  post?: {
    id: string;
    publishAttemptId: string | null;
    currentState?: string | null;
    scheduledAtUtc?: string | null;
  };
  longFormPost?: {
    id: string;
    publishAttemptId: string | null;
    currentState?: string | null;
    scheduledAtUtc?: string | null;
  };
  error?: string;
}

/**
 * When `?published=` or `?scheduled=` is present, load post and open the publish result modal.
 */
export function useNewPostPublishModalEffect(input: {
  searchParams: URLSearchParams;
  setSearchParams: (
    next: URLSearchParams,
    opts?: { replace?: boolean }
  ) => void;
  modalPostId: string | null;
  setModalPostId: (id: string | null) => void;
  setModalPost: (p: ModalPostShape | null) => void;
  setModalLongFormPost: (p: ModalPostShape | null) => void;
  setShowPublishModal: (open: boolean) => void;
  queryClient: QueryClient;
}): void {
  const {
    searchParams,
    setSearchParams,
    modalPostId,
    setModalPostId,
    setModalPost,
    setModalLongFormPost,
    setShowPublishModal,
    queryClient,
  } = input;

  useEffect(() => {
    const publishedPostId = searchParams.get("published");
    const scheduledPostId = searchParams.get("scheduled");
    const postId = publishedPostId ?? scheduledPostId;

    // No URL param to process, or we already handled this postId.
    // Note: we intentionally do NOT skip when showPublishModal is true —
    // the modal may already be open from an immediate publish intent, and
    // we still need to hydrate it with the real postId and post data.
    if (!postId || modalPostId) {
      return;
    }

    setTimeout(() => {
      setModalPostId(postId);
    }, 0);

    void (async () => {
      try {
        const res = await fetch(`/api/posts/${postId}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch: ${res.status}`);
        }
        const data = (await res.json()) as FetchPostsResponse;

        if (!data.post && !data.longFormPost) {
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.delete("published");
          newSearchParams.delete("scheduled");
          setSearchParams(newSearchParams, { replace: true });
          setTimeout(() => {
            setModalPostId(null);
          }, 0);
          return;
        }

        // Invalidate published/scheduled/dashboard/drafts/calendar queries so
        // Published and other views show the new post without a full page reload.
        if (publishedPostId || scheduledPostId) {
          scheduleRefreshPostViews(queryClient);
        }
        setTimeout(() => {
          setModalPost(data.post ?? null);
          setModalLongFormPost(data.longFormPost ?? null);
          // Ensure modal is open (may already be from publish intent; this is idempotent).
          setShowPublishModal(true);
        }, 0);

        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete("published");
        newSearchParams.delete("scheduled");
        setSearchParams(newSearchParams, { replace: true });
      } catch (error) {
        console.error("Failed to fetch post data:", error);
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete("published");
        newSearchParams.delete("scheduled");
        setSearchParams(newSearchParams, { replace: true });
        setTimeout(() => {
          setModalPostId(null);
        }, 0);
      }
    })();
  }, [
    searchParams,
    modalPostId,
    setSearchParams,
    queryClient,
    setModalPostId,
    setModalPost,
    setModalLongFormPost,
    setShowPublishModal,
  ]);
}
