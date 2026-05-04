import type {
  PostData,
  QueueType as QueueTypeFromTypes,
  UserData,
} from "~/features/posts/types";
// Re-export QueueType for convenience
export type QueueType = QueueTypeFromTypes;

export interface CalendarPost extends Omit<
  PostData,
  | "scheduledFor"
  | "publishedAt"
  | "postType"
  | "repost"
  | "isQuotedPost"
  | "manual_override"
  | "postKind"
  | "replyToEventId"
  | "replyToPostId"
> {
  title?: string;
  summary?: string;
  image?: string;
  publishedAt?: Date | string | null;
  scheduledFor?: string | null;
  queueType?: QueueType | null;
  manual_override?: boolean;
  postType?: string;
  repost?: boolean;
  isQuotedPost?: boolean;
  isPast?: boolean;
  isScheduled?: boolean; // Derived from currentState
  isPosted?: boolean; // Derived from currentState
  postKind?: PostData["postKind"];
  replyToEventId?: string | null;
  replyToPostId?: string | null;
}

export interface QueueColorStyle {
  backgroundColor: string;
  color: string;
  borderColor: string;
  opacity?: number;
  /** When true, block uses CSS vars + hover/focus/active class for background (Next 7 days–style greys). */
  isUnassigned?: boolean;
  /** Background color on hover/focus/active (darker grey); only when isUnassigned. */
  hoverBackgroundColor?: string;
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
  /** When set (e.g. in month view), rendered inside minimal block with same background as block */
  timeLabel?: string;
  /** When true, past posts render at full opacity (e.g. when expanded in weekly view). */
  forceOpaque?: boolean;
  /** When set (e.g. week multi-post slot rows), minimal block may show 2–3 lines of text when >= 2. */
  slotExpandRows?: number;
  /** When true (Day/Week view), compact block does not show thumbnail/icon next to time. */
  hideTimeRowPreview?: boolean;
  /** Day/week: post is the one open in the sidebar  -  show brand-strong selection ring only then. */
  isCalendarSelected?: boolean;
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
  /** When true, past posts render at full opacity (e.g. when expanded in weekly view). */
  forceOpaque?: boolean;
  /** See PostBlockProps.isCalendarSelected */
  isCalendarSelected?: boolean;
}
