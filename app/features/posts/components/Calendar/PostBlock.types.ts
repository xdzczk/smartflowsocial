import type { PostData, QueueType, UserData } from "~/features/posts/types";

export interface CalendarPost extends Omit<PostData, "scheduledFor" | "postedAt" | "publishedAt" | "postType" | "repost" | "isQuotedPost" | "manual_override"> {
  title?: string;
  summary?: string;
  image?: string;
  publishedAt?: Date | string | null;
  postedAt?: Date | string | null;
  scheduledFor?: string | null;
  queueType?: QueueType | null;
  manual_override?: boolean;
  postType?: string;
  repost?: boolean;
  isQuotedPost?: boolean;
  isPast?: boolean;
}

export interface QueueColorStyle {
  backgroundColor: string;
  color: string;
  borderColor: string;
  opacity?: number;
}

export interface PostBlockProps {
  post: CalendarPost;
  compact?: boolean;
  minimal?: boolean;
  thumbnailOnly?: boolean;
  multipleInCell?: boolean;
  user?: UserData | null;
  queueTypes?: QueueType[];
  onEdit?: (post: CalendarPost) => void;
  isLongform?: boolean;
  isPast?: boolean;
  hideVideoPlayButton?: boolean;
}

export interface PostBlockBaseProps {
  post: CalendarPost;
  user?: UserData | null;
  queueTypes?: QueueType[];
  onEdit?: (post: CalendarPost) => void;
  isLongform?: boolean;
  isPast?: boolean;
  isDragging?: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}


