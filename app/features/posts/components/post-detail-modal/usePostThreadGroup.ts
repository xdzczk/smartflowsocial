import { useApiQuery } from "~/lib/query/hooks/useApiQuery";

export interface ThreadGroupSegmentResponse {
  id: string;
  position: number;
  previewText: string;
  hasMedia: boolean;
}

export interface PostThreadGroupResponse {
  segments: ThreadGroupSegmentResponse[];
  currentIndex: number;
  total: number;
}

export function usePostThreadGroup(
  groupId: string | null | undefined,
  postId: string
) {
  const gid = groupId?.trim() ?? "";
  const endpoint =
    gid && postId
      ? `/api/posts/thread-group?groupId=${encodeURIComponent(gid)}&postId=${encodeURIComponent(postId)}`
      : "/api/posts/thread-group";

  return useApiQuery<PostThreadGroupResponse>(endpoint, {
    queryKey: ["post-thread-group", gid, postId],
    enabled: Boolean(gid && postId),
    staleTime: 60_000,
  });
}
