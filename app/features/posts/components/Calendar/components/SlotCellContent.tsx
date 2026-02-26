import type { QueueType, UserData } from "../../../types";
import type { SlotState } from "../domain/grid-types";
import { PostBlock } from "../PostBlock";
import type { CalendarPost } from "../PostBlock.types";

import { EmptySlotCellContent } from "./EmptySlot";
import {
  BOTTOM_ROWS_EXPAND_UP_THRESHOLD,
  EXPANDED_BLOCK_WRAPPER_CLASS,
  ROW_HEIGHT_PX,
} from "./weekly-view-constants";

export interface SlotCellContentProps {
  slotState: SlotState;
  time: string;
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
    setHoveredPostKey,
    onPostEdit,
    user,
    queueTypes,
    isLongform,
    isAll,
  } = props;
  const { posts, singlePostKey, isHovered, blockHeightPx, expandRows } =
    slotState;
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

  return wrapExpandUp(blockInner);
}

interface MultiPostBlockProps {
  post: CalendarPost;
  dateKey: string;
  time: string;
  postsCount: number;
  slotExpandRows?: number;
  alignExpandedRight?: boolean;
  hoveredPostKey: string | null;
  setHoveredPostKey: (key: string | null) => void;
  /** When true (conflicting blocks around), cap hover expansion at 3 rows. */
  noExpandOnHover?: boolean;
  onPostEdit: (post: CalendarPost) => void;
  user?: UserData | null;
  queueTypes?: QueueType[];
  isLongform: boolean;
  isAll: boolean;
}

function getMultiPostExpandRows(
  baseRows: number,
  isHovered: boolean,
  noExpandOnHover: boolean
): number {
  if (!isHovered) return Math.min(baseRows, 4);
  const targetRows = noExpandOnHover ? 3 : 4;
  return Math.max(baseRows, targetRows);
}

function MultiPostBlock({
  post,
  dateKey,
  time,
  postsCount,
  slotExpandRows,
  alignExpandedRight = false,
  hoveredPostKey,
  setHoveredPostKey,
  noExpandOnHover = false,
  onPostEdit,
  user,
  queueTypes,
  isLongform,
  isAll,
}: MultiPostBlockProps) {
  const multiPostKey = `${dateKey}-${time}-${post.id}`;
  const multiHovered = hoveredPostKey === multiPostKey;
  const baseRows = slotExpandRows ?? 1;
  // On hover: expand to 4 rows when there is room, or cap at 3 when conflicting rows exist.
  const multiExpandRows = getMultiPostExpandRows(
    baseRows,
    multiHovered,
    noExpandOnHover
  );
  const multiHeightPx = multiExpandRows * ROW_HEIGHT_PX - 4;
  const expandedClass = multiHovered
    ? `${EXPANDED_BLOCK_WRAPPER_CLASS} absolute top-0 z-10 min-w-0`
    : "relative z-0 min-w-0 flex-1";
  // Tailwind `space-x-0.5` = 0.125rem horizontal gap between sibling blocks.
  const fullWidthForHovered = `calc(${postsCount * 100}% + ${(postsCount - 1) * 0.125}rem)`;
  const expandedStyle = multiHovered
    ? {
        ...(alignExpandedRight ? { right: 0 } : { left: 0 }),
        width: fullWidthForHovered,
      }
    : {};
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Hover/focus wrapper for expansion; PostBlock inside is interactive
    <div
      className={`transition-[height] duration-200 ease-out ${expandedClass}`}
      style={{ height: multiHeightPx, ...expandedStyle }}
      onMouseEnter={() => setHoveredPostKey(multiPostKey)}
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
  wrapExpandUp: (content: React.ReactNode) => React.ReactNode
): React.ReactNode {
  const {
    slotState,
    time,
    hoveredPostKey,
    setHoveredPostKey,
    onPostEdit,
    user,
    queueTypes,
    isLongform,
    isAll,
  } = props;
  const { dateKey, posts, expandRows, blockHeightPx, noExpandOnHover } =
    slotState;

  const multiPostBlockProps = {
    dateKey,
    time,
    postsCount: posts.length,
    slotExpandRows: expandRows,
    hoveredPostKey,
    setHoveredPostKey,
    noExpandOnHover,
    onPostEdit,
    user,
    queueTypes,
    isLongform,
    isAll,
  };

  if (posts.length <= 6) {
    return wrapExpandUp(
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Row-level hover leave handler to clear multi-post hover state for wrappers inside
      <div
        className="relative flex space-x-0.5"
        style={{ height: blockHeightPx }}
        onMouseLeave={() => setHoveredPostKey(null)}
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
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Row-level hover leave handler to clear multi-post hover state for wrappers inside
    <div
      className="relative flex space-x-0.5"
      style={{ height: blockHeightPx }}
      onMouseLeave={() => setHoveredPostKey(null)}
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

export function SlotCellContent(props: SlotCellContentProps) {
  const {
    slotState,
    time,
    rowIndex = 0,
    availableRowsBelow = 0,
    onPostEdit: _onPostEdit,
    user,
    queueTypes: _queueTypes,
    isLongform: _isLongform,
    isAll: _isAll,
    activeEmptySlotKey,
    setActiveEmptySlotKey,
    onClearSelection,
  } = props;
  const {
    dateKey,
    posts,
    blockHeightPx,
    slotKey,
    expandRows,
    noExpandOnHover,
  } = slotState;
  const hoveredPostKey = props.hoveredPostKey;

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
  const allocatedHeightPx = availableRowsBelow * ROW_HEIGHT_PX;
  // Multi-post in bottom rows: when any block is hovered it can expand to 4 rows; use that height for the wrapper so it doesn't clip
  const multiPostHovered =
    posts.length > 1 &&
    posts.some((p) => hoveredPostKey === `${dateKey}-${time}-${p.id}`);
  const effectiveBlockHeightPx = multiPostHovered
    ? Math.max(
        blockHeightPx,
        getMultiPostExpandRows(expandRows, true, noExpandOnHover) *
          ROW_HEIGHT_PX -
          4
      )
    : blockHeightPx;
  const blockExceedsBelow = effectiveBlockHeightPx > allocatedHeightPx;
  const shouldGrowUp =
    availableRowsBelow > 0 && (expandUp || blockExceedsBelow);
  const expandUpTop =
    shouldGrowUp && blockExceedsBelow
      ? allocatedHeightPx - effectiveBlockHeightPx
      : 0;
  const wrapExpandUp = (content: React.ReactNode) =>
    shouldGrowUp ? (
      <div
        className="relative w-full min-w-0 overflow-x-hidden overflow-y-visible"
        style={{ height: allocatedHeightPx }}
      >
        <div
          className="relative w-full min-w-0"
          style={{ top: expandUpTop, height: effectiveBlockHeightPx }}
        >
          {content}
        </div>
      </div>
    ) : (
      content
    );

  if (posts.length === 1) {
    return renderSinglePostSlotContent(props, expandUp, wrapExpandUp);
  }

  return renderMultiPostSlotContent(props, wrapExpandUp);
}
