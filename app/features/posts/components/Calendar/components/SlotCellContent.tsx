import type { QueueType, UserData } from "../../../types";
import type { SlotState } from "../domain/grid-types";
import { PostBlock } from "../PostBlock";
import type { CalendarPost } from "../PostBlock.types";

import { DayViewEmptyColumnArea, EmptySlotCellContent } from "./EmptySlot";
import {
  BOTTOM_ROWS_EXPAND_UP_THRESHOLD,
  CLASS_DAY_COLUMN_EXPAND_UP,
  CLASS_OVERFLOW_HIDDEN,
  EXPANDED_BLOCK_WRAPPER_CLASS,
  ROW_HEIGHT_PX,
} from "./weekly-view-constants";

export interface SlotCellContentProps {
  slotState: SlotState;
  time: string;
  isDayView: boolean;
  /** In day view: 0 = left column, 1 = right column for alternating single-post blocks */
  slotColumn?: 0 | 1;
  /** Row index (0–47); when >= BOTTOM_ROWS_EXPAND_UP_THRESHOLD, blocks expand upward on hover. */
  rowIndex?: number;
  /** Rows from this slot to end of day (for bottom rows: cap expansion downward and grow upward instead). */
  availableRowsBelow?: number;
  hoveredPostKey: string | null;
  setHoveredPostKey: (key: string | null) => void;
  onPostEdit: (post: CalendarPost) => void;
  user?: UserData | null;
  queueTypes?: QueueType[];
  isLongform: boolean;
  isAll: boolean;
  /** When set, the empty-slot + menu is shown only for this slot (after user click/touch). */
  activeEmptySlotKey: string | null;
  setActiveEmptySlotKey: (key: string | null) => void;
  /** Day view: clear selected post when empty space is clicked. */
  onClearSelection?: () => void;
}

/** Renders the single-post slot content (day view two-column or plain block). */
function renderSinglePostSlotContent(
  props: SlotCellContentProps,
  expandUp: boolean,
  wrapExpandUp: (content: React.ReactNode) => React.ReactNode
): React.ReactNode {
  const {
    slotState,
    time,
    isDayView,
    slotColumn,
    setHoveredPostKey,
    onPostEdit,
    user,
    queueTypes,
    isLongform,
    isAll,
    activeEmptySlotKey,
    setActiveEmptySlotKey,
    onClearSelection,
  } = props;
  const {
    dateKey,
    posts,
    singlePostKey,
    isHovered,
    blockHeightPx,
    expandRows,
    slotKey,
  } = slotState;
  const post = posts[0];
  if (!post) return null;

  const blockInner = (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Hover/focus wrapper for expansion; PostBlock inside is interactive
    <div
      className={`w-full min-w-0 transition-[height] duration-200 ease-out ${
        expandUp && isHovered
          ? `absolute right-0 bottom-0 left-0 ${EXPANDED_BLOCK_WRAPPER_CLASS}`
          : isHovered
            ? `${EXPANDED_BLOCK_WRAPPER_CLASS} relative`
            : "relative z-0"
      }`}
      style={{ height: blockHeightPx }}
      onMouseEnter={() => singlePostKey && setHoveredPostKey(singlePostKey)}
      onMouseLeave={() => setHoveredPostKey(null)}
      onFocusCapture={() => singlePostKey && setHoveredPostKey(singlePostKey)}
      onBlurCapture={() => setHoveredPostKey(null)}
      onTouchStart={() => singlePostKey && setHoveredPostKey(singlePostKey)}
      onTouchEnd={() => setTimeout(() => setHoveredPostKey(null), 300)}
    >
      <PostBlock
        post={post}
        compact={true}
        user={user}
        queueTypes={queueTypes}
        onEdit={onPostEdit}
        isLongform={
          isAll ? Boolean(post.title && post.publishedAt) : isLongform
        }
        isPast={typeof post.isPast === "boolean" ? post.isPast : false}
        forceOpaque={isHovered}
        hideTimeRowPreview={true}
        slotExpandRows={expandRows}
      />
    </div>
  );

  if (isDayView) {
    const userTz = user?.timezone ?? "UTC";
    const emptyColumn = (
      <DayViewEmptyColumnArea
        dateKey={dateKey}
        time={time}
        slotKey={slotKey}
        blockHeightPx={blockHeightPx}
        userTimezone={userTz}
        activeEmptySlotKey={activeEmptySlotKey}
        setActiveEmptySlotKey={setActiveEmptySlotKey}
        onClearSelection={onClearSelection}
      />
    );
    const overflowClass =
      expandUp && isHovered
        ? CLASS_DAY_COLUMN_EXPAND_UP
        : CLASS_OVERFLOW_HIDDEN;
    // isolate: each column has its own stacking context so hover/active in one column doesn't block the other
    return wrapExpandUp(
      <div className="flex w-full gap-1">
        <div className={`isolate min-w-0 flex-1 ${overflowClass}`}>
          {slotColumn === 0 ? (
            <div className={`relative h-full w-full min-w-0 ${overflowClass}`}>
              {blockInner}
            </div>
          ) : (
            emptyColumn
          )}
        </div>
        <div
          className={`isolate flex min-w-0 flex-1 justify-end ${overflowClass}`}
        >
          {slotColumn === 1 ? (
            <div className={`relative h-full w-full min-w-0 ${overflowClass}`}>
              {blockInner}
            </div>
          ) : (
            emptyColumn
          )}
        </div>
      </div>
    );
  }
  return wrapExpandUp(blockInner);
}

/** In Daily view, max expanded rows per multi-post block by number of blocks in the row: 3→5, 4→4, 5+→3. */
function getDayViewMultiMaxRows(postsCount: number): number {
  if (postsCount <= 2) return 3;
  if (postsCount === 3) return 5;
  if (postsCount === 4) return 4;
  return 3;
}

interface MultiPostBlockProps {
  post: CalendarPost;
  dateKey: string;
  time: string;
  isDayView: boolean;
  postsCount: number;
  slotExpandRows?: number;
  expandUp?: boolean;
  alignExpandedRight?: boolean;
  hoveredPostKey: string | null;
  setHoveredPostKey: (key: string | null) => void;
  onPostEdit: (post: CalendarPost) => void;
  user?: UserData | null;
  queueTypes?: QueueType[];
  isLongform: boolean;
  isAll: boolean;
}

function MultiPostBlock({
  post,
  dateKey,
  time,
  isDayView,
  postsCount,
  slotExpandRows,
  expandUp = false,
  alignExpandedRight: _alignExpandedRight = false,
  hoveredPostKey,
  setHoveredPostKey,
  onPostEdit,
  user,
  queueTypes,
  isLongform,
  isAll,
}: MultiPostBlockProps) {
  const multiPostKey = `${dateKey}-${time}-${post.id}`;
  const multiHovered = hoveredPostKey === multiPostKey;
  const multiExpandRows = isDayView
    ? multiHovered
      ? getDayViewMultiMaxRows(postsCount)
      : (slotExpandRows ?? 1)
    : multiHovered
      ? (slotExpandRows ?? 0) >= 3
        ? (slotExpandRows ?? 1)
        : 4
      : Math.min(slotExpandRows ?? 1, 4);
  const multiHeightPx = multiExpandRows * ROW_HEIGHT_PX - 4;
  const expandedClass = multiHovered
    ? isDayView
      ? expandUp
        ? `${EXPANDED_BLOCK_WRAPPER_CLASS} absolute bottom-0 left-0 right-0 w-full`
        : `${EXPANDED_BLOCK_WRAPPER_CLASS} relative min-w-0 flex-1`
      : expandUp
        ? `${EXPANDED_BLOCK_WRAPPER_CLASS} absolute bottom-0 left-0 right-0 w-full`
        : `${EXPANDED_BLOCK_WRAPPER_CLASS} absolute inset-0 w-full`
    : "relative z-0 min-w-0 flex-1";
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Hover/focus wrapper for expansion; PostBlock inside is interactive
    <div
      className={`transition-[height] duration-200 ease-out ${expandedClass}`}
      style={{ height: multiHeightPx }}
      onMouseEnter={() => setHoveredPostKey(multiPostKey)}
      onMouseLeave={() => setHoveredPostKey(null)}
      onFocusCapture={() => setHoveredPostKey(multiPostKey)}
      onBlurCapture={() => setHoveredPostKey(null)}
      onTouchStart={() => setHoveredPostKey(multiPostKey)}
      onTouchEnd={() => setTimeout(() => setHoveredPostKey(null), 300)}
    >
      <PostBlock
        post={post}
        compact={true}
        minimal={true}
        user={user}
        queueTypes={queueTypes}
        onEdit={onPostEdit}
        isLongform={
          isAll ? Boolean(post.title && post.publishedAt) : isLongform
        }
        isPast={typeof post.isPast === "boolean" ? post.isPast : false}
        multipleInCell={true}
        forceOpaque={multiHovered}
        hideTimeRowPreview={true}
        slotExpandRows={multiExpandRows}
      />
    </div>
  );
}

/** Renders multi-post slot row (≤6 posts or 5 + overflow). */
function renderMultiPostSlotContent(
  props: SlotCellContentProps,
  expandUp: boolean,
  wrapExpandUp: (content: React.ReactNode) => React.ReactNode
): React.ReactNode {
  const {
    slotState,
    time,
    isDayView,
    hoveredPostKey,
    setHoveredPostKey,
    onPostEdit,
    user,
    queueTypes,
    isLongform,
    isAll,
  } = props;
  const { dateKey, posts, expandRows, blockHeightPx } = slotState;

  const multiPostBlockProps = {
    dateKey,
    time,
    isDayView,
    postsCount: posts.length,
    slotExpandRows: expandRows,
    expandUp,
    hoveredPostKey,
    setHoveredPostKey,
    onPostEdit,
    user,
    queueTypes,
    isLongform,
    isAll,
  };

  if (posts.length <= 6) {
    return wrapExpandUp(
      <div
        className="relative flex space-x-0.5"
        style={{ height: blockHeightPx }}
      >
        {posts.map((post, index) => (
          <MultiPostBlock
            key={post.id}
            post={post}
            {...multiPostBlockProps}
            alignExpandedRight={index >= posts.length / 2}
          />
        ))}
      </div>
    );
  }

  return wrapExpandUp(
    <div
      className="relative flex space-x-0.5"
      style={{ height: blockHeightPx }}
    >
      {posts.slice(0, 5).map((post, index) => (
        <MultiPostBlock
          key={post.id}
          post={post}
          {...multiPostBlockProps}
          alignExpandedRight={index >= 3}
        />
      ))}
      <div className="bg-muted text-muted-foreground flex flex-1 items-center justify-center rounded text-xs">
        +{posts.length - 5}
      </div>
    </div>
  );
}

export function SlotCellContent({
  slotState,
  time,
  isDayView,
  slotColumn,
  rowIndex = 0,
  availableRowsBelow = 0,
  hoveredPostKey,
  setHoveredPostKey,
  onPostEdit,
  user,
  queueTypes,
  isLongform,
  isAll,
  activeEmptySlotKey,
  setActiveEmptySlotKey,
  onClearSelection,
}: SlotCellContentProps) {
  const { dateKey, posts, blockHeightPx, expandRows, slotKey } = slotState;

  if (posts.length === 0) {
    return (
      <EmptySlotCellContent
        dateKey={dateKey}
        time={time}
        slotKey={slotKey}
        userTimezone={user?.timezone ?? "UTC"}
        activeEmptySlotKey={activeEmptySlotKey}
        setActiveEmptySlotKey={setActiveEmptySlotKey}
        onClearSelection={onClearSelection}
      />
    );
  }

  const expandUp = rowIndex >= BOTTOM_ROWS_EXPAND_UP_THRESHOLD;
  const rowsToGrowUp =
    expandUp && availableRowsBelow > 0 && expandRows > availableRowsBelow
      ? expandRows - availableRowsBelow
      : 0;
  const expandUpTop =
    rowsToGrowUp > 0 ? availableRowsBelow * ROW_HEIGHT_PX - blockHeightPx : 0;
  const wrapExpandUp = (content: React.ReactNode) =>
    rowsToGrowUp > 0 ? (
      <div
        className="relative w-full min-w-0 overflow-hidden"
        style={{ height: availableRowsBelow * ROW_HEIGHT_PX }}
      >
        <div
          className="relative w-full min-w-0"
          style={{ top: expandUpTop, height: blockHeightPx }}
        >
          {content}
        </div>
      </div>
    ) : (
      content
    );

  if (posts.length === 1) {
    return renderSinglePostSlotContent(
      {
        slotState,
        time,
        isDayView,
        slotColumn,
        rowIndex,
        availableRowsBelow,
        hoveredPostKey,
        setHoveredPostKey,
        onPostEdit,
        user,
        queueTypes,
        isLongform,
        isAll,
        activeEmptySlotKey,
        setActiveEmptySlotKey,
        onClearSelection,
      },
      expandUp,
      wrapExpandUp
    );
  }

  return renderMultiPostSlotContent(
    {
      slotState,
      time,
      isDayView,
      slotColumn,
      rowIndex,
      availableRowsBelow,
      hoveredPostKey,
      setHoveredPostKey,
      onPostEdit,
      user,
      queueTypes,
      isLongform,
      isAll,
      activeEmptySlotKey,
      setActiveEmptySlotKey,
      onClearSelection,
    },
    expandUp,
    wrapExpandUp
  );
}
