import type {
  BulkPost,
  CombinedContent,
  PostData,
} from "~/features/posts/types";
import type { UserData } from "~/lib/validation/user-data";

export interface QuotePostData {
  caption: string;
  fileUrl: string;
  queueType: string;
  scheduledFor: string;
  originalPostId: string;
  originalEventId?: string;
  originalEventPubkey?: string;
  isQuotePost?: boolean;
  originalCaption?: string;
}

export interface FetcherErrorResponse {
  error?: string;
  message?: string;
}

export type BulkComposerPayload =
  | { mode: "recycle"; initialPosts: BulkPost[] }
  | { mode: "repost"; scheduledRepostData: unknown[] }
  | { mode: "quote"; initialPosts: BulkPost[] };

export interface UsePublishedPostsProps {
  user: UserData | null;
  allContent: CombinedContent[];
  posts: PostData[];
  /** When set, bulk repost/quote/recycle open the in-page composer modal instead of redirecting. */
  onOpenBulkComposer?: (payload: BulkComposerPayload) => void;
}
