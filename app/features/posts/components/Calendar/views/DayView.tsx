/**
 * Day view: single-day time grid. Thin wrapper; delegates to shared time-grid implementation.
 */

import type { QueueType, UserData } from "../../../types";
import type { CalendarPost } from "../PostBlock.types";
import { WeeklyView } from "../WeeklyView";

export interface DayViewProps {
  scheduledPosts: CalendarPost[];
  pastPosts?: CalendarPost[];
  currentDate: Date;
  onPostDrop: (post: CalendarPost, newDateTime: Date) => void;
  onPostEdit: (post: CalendarPost) => void;
  selectedPost?: CalendarPost | null;
  onClearSelection?: () => void;
  user?: UserData | null;
  queueTypes?: QueueType[];
  isLongform?: boolean;
  isAll?: boolean;
}

export function DayView({
  scheduledPosts,
  pastPosts,
  currentDate,
  onPostDrop,
  onPostEdit,
  selectedPost,
  onClearSelection,
  user,
  queueTypes,
  isLongform = false,
  isAll = false,
}: DayViewProps) {
  return (
    <WeeklyView
      scheduledPosts={scheduledPosts}
      pastPosts={pastPosts}
      currentDate={currentDate}
      weekDaysOverride={[currentDate]}
      onPostDrop={onPostDrop}
      onPostEdit={onPostEdit}
      selectedPost={selectedPost}
      onClearSelection={onClearSelection}
      user={user}
      queueTypes={queueTypes}
      isLongform={isLongform}
      isAll={isAll}
    />
  );
}
