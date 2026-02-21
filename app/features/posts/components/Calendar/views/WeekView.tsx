/**
 * Week view: 7-day time grid. Thin wrapper; delegates to shared time-grid implementation.
 */

import type { QueueType, UserData } from "../../../types";
import type { CalendarPost } from "../PostBlock.types";
import { WeeklyView } from "../WeeklyView";

export interface WeekViewProps {
  scheduledPosts: CalendarPost[];
  pastPosts?: CalendarPost[];
  currentDate: Date;
  onPostDrop: (post: CalendarPost, newDateTime: Date) => void;
  onPostEdit: (post: CalendarPost) => void;
  user?: UserData | null;
  queueTypes?: QueueType[];
  isLongform?: boolean;
  isAll?: boolean;
}

export function WeekView({
  scheduledPosts,
  pastPosts,
  currentDate,
  onPostDrop,
  onPostEdit,
  user,
  queueTypes,
  isLongform = false,
  isAll = false,
}: WeekViewProps) {
  return (
    <WeeklyView
      scheduledPosts={scheduledPosts}
      pastPosts={pastPosts}
      currentDate={currentDate}
      onPostDrop={onPostDrop}
      onPostEdit={onPostEdit}
      user={user}
      queueTypes={queueTypes}
      isLongform={isLongform}
      isAll={isAll}
    />
  );
}
