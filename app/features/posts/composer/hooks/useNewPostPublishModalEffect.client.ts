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
  showPublishModal: boolean;
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
    showPublishModal,
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

    if (!postId || modalPostId || showPublishModal) {
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
    showPublishModal,
    setSearchParams,
    queryClient,
    setModalPostId,
    setModalPost,
    setModalLongFormPost,
    setShowPublishModal,
  ]);
}
