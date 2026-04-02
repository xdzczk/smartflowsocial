import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { scheduleRefreshPostViews } from "~/features/posts/hooks/useRefreshPostViews";

interface ModalPost {
  id: string;
  publishAttemptId: string | null;
  currentState?: string | null;
  scheduledAtUtc?: Date | null;
}

interface UsePostResultFromUrlOptions {
  paramName: "scheduled" | "published";
  searchParams: URLSearchParams;
  setSearchParams: (
    params: URLSearchParams,
    opts: { replace: boolean }
  ) => void;
  user: unknown;
  modalPostId: string | null;
  showPublishModal: boolean;
  setModalPostId: (id: string | null) => void;
  setModalPost: (p: ModalPost | null) => void;
  setModalLongFormPost: (p: ModalPost | null) => void;
  setShowPublishModal: (show: boolean) => void;
}

/**
 * Syncs URL param (e.g. ?scheduled=id or ?published=id) with publish result modal state:
 * fetches post data and opens the modal when the param is present.
 */
export function usePostResultFromUrl({
  paramName,
  searchParams,
  setSearchParams,
  user,
  modalPostId,
  showPublishModal,
  setModalPostId,
  setModalPost,
  setModalLongFormPost,
  setShowPublishModal,
}: UsePostResultFromUrlOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const postId = searchParams.get(paramName);
    if (!postId || !user || modalPostId || showPublishModal) return;

    setTimeout(() => setModalPostId(postId), 0);

    void (async () => {
      try {
        const res = await fetch(`/api/posts/${postId}`);
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        const data = (await res.json()) as {
          post?: ModalPost;
          longFormPost?: ModalPost;
        };
        if (data.post || data.longFormPost) {
          if (paramName === "scheduled") {
            scheduleRefreshPostViews(queryClient);
          }
          setTimeout(() => {
            setModalPost(data.post ?? null);
            setModalLongFormPost(data.longFormPost ?? null);
            setShowPublishModal(true);
          }, 0);
          const next = new URLSearchParams(searchParams);
          next.delete(paramName);
          setSearchParams(next, { replace: true });
        }
      } catch (error) {
        console.error("Failed to fetch post data:", error);
        setTimeout(() => setModalPostId(null), 0);
      }
    })();
  }, [
    paramName,
    searchParams,
    user,
    modalPostId,
    showPublishModal,
    setModalPostId,
    setModalPost,
    setModalLongFormPost,
    setShowPublishModal,
    setSearchParams,
    queryClient,
  ]);
}
