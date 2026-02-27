import type { QueueType, UserData } from "../../../types";
import type { HoverOverlayPayload, SlotState } from "../domain/grid-types";
import { PostBlock } from "../PostBlock";
import type { CalendarPost } from "../PostBlock.types";

import { EmptySlotCellContent } from "./EmptySlot";
import {
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
  columnIndex?: number;
  onHoverOverlayChange?: (payload: HoverOverlayPayload | null) => void;
  onClearSelection?: () => void;
}

/** Renders the single-post slot content (day view two-column or plain block). */
function renderSinglePostSlotContent(
  props: SlotCellContentProps,
  shouldGrowUp: boolean,
  wrapExpandUp: (content: React.ReactNode) => React.ReactNode,
  singleOverlayPayload: HoverOverlayPayload | null,
  singleHovered: boolean
): React.ReactNode {
  const {
    slotState,
    setHoveredPostKey,
    onPostEdit,
    setActiveEmptySlotKey,
    onHoverOverlayChange,
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
        shouldGrowUp
          ? `absolute right-0 bottom-0 left-0 ${isHovered ? EXPANDED_BLOCK_WRAPPER_CLASS : "z-0"}`
          : isHovered
            ? `${EXPANDED_BLOCK_WRAPPER_CLASS} relative`
            : "relative z-0"
      } ${singleOverlayPayload && singleHovered ? "opacity-0" : ""}`}
      style={{ height: blockHeightPx }}
      onMouseEnter={() => {
        if (!singlePostKey) return;
        setHoveredPostKey(singlePostKey);
        onHoverOverlayChange?.(singleOverlayPayload);
      }}
      onMouseLeave={() => {
        setHoveredPostKey(null);
        onHoverOverlayChange?.(null);
      }}
      onFocusCapture={() => {
        if (!singlePostKey) return;
        setHoveredPostKey(singlePostKey);
        onHoverOverlayChange?.(singleOverlayPayload);
      }}
      onBlurCapture={() => {
        setHoveredPostKey(null);
        onHoverOverlayChange?.(null);
      }}
      onTouchStart={() => {
        if (!singlePostKey) return;
        setHoveredPostKey(singlePostKey);
        onHoverOverlayChange?.(singleOverlayPayload);
      }}
      onTouchEnd={() =>
        setTimeout(() => {
          setHoveredPostKey(null);
          onHoverOverlayChange?.(null);
        }, 300)
      }
    >
      <PostBlock
        post={post}
        compact={true}
        user={user}
        queueTypes={queueTypes}
        onEdit={(editedPost) => {
          setActiveEmptySlotKey(null);
          onPostEdit(editedPost);
        }}
        isLongform={
          isAll ? Boolean(post.title && post.publishedAt) : isLongform
        }
        isPast={typeof post.isPast === "boolean" ? post.isPast : false}
        forceOpaque={singleHovered || isHovered}
        hideTimeRowPreview={true}
        slotExpandRows={expandRows}
      />
    </div>
  );

  return wrapExpandUp(blockInner);
}

interface MultiPostBlockProps {
  post: CalendarPost;
  postOccurrence: number;
  dateKey: string;
  time: string;
  slotExpandRows?: number;
  hoveredPostKey: string | null;
  setHoveredPostKey: (key: string | null) => void;
  /** When true (conflicting blocks around), cap hover expansion at 3 rows. */
  noExpandOnHover?: boolean;
  onPostEdit: (post: CalendarPost) => void;
  setActiveEmptySlotKey: (key: string | null) => void;
  user?: UserData | null;
  queueTypes?: QueueType[];
  isLongform: boolean;
  isAll: boolean;
  overlayPayload: HoverOverlayPayload | null;
  onHoverOverlayChange?: (payload: HoverOverlayPayload | null) => void;
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

function getSinglePostExpandRows(
  baseRows: number,
  isHovered: boolean,
  noExpandOnHover: boolean
): number {
  if (!isHovered) return baseRows;
  return Math.max(baseRows, noExpandOnHover ? 3 : Math.min(baseRows + 2, 4));
}

interface HoverLayoutMetrics {
  topPx: number;
  heightPx: number;
}

function getHoverLayoutMetrics(
  rowIndex: number,
  availableRowsBelow: number,
  blockHeightPx: number,
  firstConflictOffsetBelow: number | null,
  firstConflictOffsetAbove: number | null
): HoverLayoutMetrics {
  const allocatedHeightPx = availableRowsBelow * ROW_HEIGHT_PX;
  const expandRowsEffective = Math.max(
    1,
    Math.ceil((blockHeightPx + 4) / ROW_HEIGHT_PX)
  );
  const shouldShiftUpForConflict =
    firstConflictOffsetBelow !== null && firstConflictOffsetAbove === null;
  const shiftRowsForConflict = shouldShiftUpForConflict
    ? Math.max(0, expandRowsEffective - firstConflictOffsetBelow)
    : 0;
  const shiftRowsUp = Math.min(rowIndex, shiftRowsForConflict);
  const blockExceedsBelow = blockHeightPx > allocatedHeightPx;
  const shouldGrowUp =
    availableRowsBelow > 0 && (blockExceedsBelow || shiftRowsUp > 0);
  const expandUpTop =
    shouldGrowUp && blockExceedsBelow
      ? allocatedHeightPx - blockHeightPx
      : -shiftRowsUp * ROW_HEIGHT_PX;
  return {
    topPx: rowIndex * ROW_HEIGHT_PX + (shouldGrowUp ? expandUpTop : 0),
    heightPx: blockHeightPx,
  };
}

function getMultiPostHoverKey(
  dateKey: string,
  time: string,
  postId: string,
  postOccurrence: number
): string {
  return `${dateKey}-${time}-${postId}#${postOccurrence}`;
}

function getPostOccurrences(posts: CalendarPost[]): number[] {
  const seen = new Map<string, number>();
  return posts.map((post) => {
    const postOccurrence = seen.get(post.id) ?? 0;
    seen.set(post.id, postOccurrence + 1);
    return postOccurrence;
  });
}

function MultiPostBlock({
  post,
  postOccurrence,
  dateKey,
  time,
  slotExpandRows,
  hoveredPostKey,
  setHoveredPostKey,
  noExpandOnHover: _noExpandOnHover = false,
  onPostEdit,
  setActiveEmptySlotKey,
  overlayPayload,
  onHoverOverlayChange,
  user,
  queueTypes,
  isLongform,
  isAll,
}: MultiPostBlockProps) {
  const multiPostKey = getMultiPostHoverKey(
    dateKey,
    time,
    post.id,
    postOccurrence
  );
  const multiHovered = hoveredPostKey === multiPostKey;
  const baseRows = slotExpandRows ?? 1;
  const multiExpandRows = baseRows;
  const multiHeightPx = multiExpandRows * ROW_HEIGHT_PX - 4;
  const expandedClass = multiHovered
    ? `${EXPANDED_BLOCK_WRAPPER_CLASS} relative z-20 min-w-0 flex-1`
    : "relative z-0 min-w-0 flex-1";
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Hover/focus wrapper for expansion; PostBlock inside is interactive
    <div
      className={`transition-[height,opacity] duration-200 ease-out ${expandedClass} ${
        overlayPayload && multiHovered ? "opacity-0" : ""
      }`}
      style={{ height: multiHeightPx }}
      onMouseEnter={() => {
        setHoveredPostKey(multiPostKey);
        onHoverOverlayChange?.(overlayPayload);
      }}
      onFocusCapture={() => {
        setHoveredPostKey(multiPostKey);
        onHoverOverlayChange?.(overlayPayload);
      }}
      onBlurCapture={() => {
        setHoveredPostKey(null);
        onHoverOverlayChange?.(null);
      }}
      onTouchStart={() => {
        setHoveredPostKey(multiPostKey);
        onHoverOverlayChange?.(overlayPayload);
      }}
      onTouchEnd={() =>
        setTimeout(() => {
          setHoveredPostKey(null);
          onHoverOverlayChange?.(null);
        }, 300)
      }
    >
      <PostBlock
        post={post}
        compact={true}
        minimal={true}
        user={user}
        queueTypes={queueTypes}
        onEdit={(editedPost) => {
          setActiveEmptySlotKey(null);
          onPostEdit(editedPost);
        }}
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
  wrapExpandUp: (content: React.ReactNode) => React.ReactNode,
  overlayTopPx: number
): React.ReactNode {
  const {
    slotState,
    time,
    hoveredPostKey,
    setHoveredPostKey,
    onHoverOverlayChange,
    onPostEdit,
    user,
    queueTypes,
    isLongform,
    isAll,
  } = props;
  const { dateKey, posts, expandRows, blockHeightPx, noExpandOnHover } =
    slotState;
  const postOccurrences = getPostOccurrences(posts);
  const multiPostHoveredHeightPx =
    getMultiPostExpandRows(expandRows, true, noExpandOnHover) * ROW_HEIGHT_PX -
    4;
  const rowHeightPx = blockHeightPx;

  const multiPostBlockProps = {
    dateKey,
    time,
    slotExpandRows: expandRows,
    hoveredPostKey,
    setHoveredPostKey,
    noExpandOnHover,
    onPostEdit,
    setActiveEmptySlotKey: props.setActiveEmptySlotKey,
    user,
    queueTypes,
    isLongform,
    isAll,
  };
  const overlayRows = getMultiPostExpandRows(expandRows, true, noExpandOnHover);
  const overlayPayloadByIndex = posts.map((post, index) => {
    return {
      key: getMultiPostHoverKey(
        dateKey,
        time,
        post.id,
        postOccurrences[index] ?? 0
      ),
      post,
      dateKey,
      time,
      rowIndex: props.rowIndex ?? 0,
      columnIndex: props.columnIndex ?? 0,
      topPx: overlayTopPx,
      heightPx: multiPostHoveredHeightPx,
      expandedRows: overlayRows,
      isLongform: isAll ? Boolean(post.title && post.publishedAt) : isLongform,
      isPast: typeof post.isPast === "boolean" ? post.isPast : false,
    } satisfies HoverOverlayPayload;
  });

  if (posts.length <= 6) {
    return wrapExpandUp(
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Row-level leave clears hover once pointer exits whole multi-post group
      <div
        className="relative flex space-x-0.5"
        style={{ height: rowHeightPx }}
        onMouseLeave={() => {
          setHoveredPostKey(null);
          onHoverOverlayChange?.(null);
        }}
      >
        {posts.map((post, index) => (
          <MultiPostBlock
            key={`${post.id}#${postOccurrences[index] ?? 0}`}
            post={post}
            postOccurrence={postOccurrences[index] ?? 0}
            overlayPayload={overlayPayloadByIndex[index] ?? null}
            onHoverOverlayChange={onHoverOverlayChange}
            {...multiPostBlockProps}
          />
        ))}
      </div>
    );
  }

  return wrapExpandUp(
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Row-level leave clears hover once pointer exits whole multi-post group
    <div
      className="relative flex space-x-0.5"
      style={{ height: rowHeightPx }}
      onMouseLeave={() => {
        setHoveredPostKey(null);
        onHoverOverlayChange?.(null);
      }}
    >
      {posts.slice(0, 5).map((post, index) => (
        <MultiPostBlock
          key={`${post.id}#${postOccurrences[index] ?? 0}`}
          post={post}
          postOccurrence={postOccurrences[index] ?? 0}
          overlayPayload={overlayPayloadByIndex[index] ?? null}
          onHoverOverlayChange={onHoverOverlayChange}
          {...multiPostBlockProps}
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
    isHovered: _isHovered,
    slotKey,
    expandRows,
    noExpandOnHover,
    firstConflictOffsetBelow,
    firstConflictOffsetAbove,
  } = slotState;
  const hoveredPostKey = props.hoveredPostKey;
  const singleHovered =
    posts.length === 1 && slotState.singlePostKey === hoveredPostKey;
  const slotPostOccurrences = getPostOccurrences(posts);

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

  const allocatedHeightPx = availableRowsBelow * ROW_HEIGHT_PX;
  const _multiPostHovered =
    posts.length > 1 &&
    posts.some(
      (p, index) =>
        hoveredPostKey ===
        getMultiPostHoverKey(
          dateKey,
          time,
          p.id,
          slotPostOccurrences[index] ?? 0
        )
    );
  const singleTargetRows = getSinglePostExpandRows(
    expandRows,
    true,
    noExpandOnHover
  );
  const singleTargetHeightPx = singleTargetRows * ROW_HEIGHT_PX - 4;
  const multiTargetRows = getMultiPostExpandRows(
    expandRows,
    true,
    noExpandOnHover
  );
  const multiTargetHeightPx = multiTargetRows * ROW_HEIGHT_PX - 4;
  const baseBlockHeightPx = blockHeightPx;
  const baseBlockExceedsBelow = baseBlockHeightPx > allocatedHeightPx;
  const shouldGrowUp = availableRowsBelow > 0 && baseBlockExceedsBelow;
  const expandUpTop = shouldGrowUp ? allocatedHeightPx - baseBlockHeightPx : 0;
  const singleHoverLayout = getHoverLayoutMetrics(
    rowIndex,
    availableRowsBelow,
    singleTargetHeightPx,
    firstConflictOffsetBelow,
    firstConflictOffsetAbove
  );
  const multiHoverLayout = getHoverLayoutMetrics(
    rowIndex,
    availableRowsBelow,
    multiTargetHeightPx,
    firstConflictOffsetBelow,
    firstConflictOffsetAbove
  );
  const singlePost = posts[0];
  const singleOverlayPayload =
    posts.length === 1 && singlePost && slotState.singlePostKey !== null
      ? ({
          key: slotState.singlePostKey,
          post: singlePost,
          dateKey,
          time,
          rowIndex,
          columnIndex: props.columnIndex ?? 0,
          topPx: singleHoverLayout.topPx,
          heightPx: singleTargetHeightPx,
          expandedRows: singleTargetRows,
          isLongform: _isAll
            ? Boolean(singlePost.title && singlePost.publishedAt)
            : props.isLongform,
          isPast:
            typeof singlePost.isPast === "boolean" ? singlePost.isPast : false,
        } satisfies HoverOverlayPayload)
      : null;
  const wrapExpandUp = (content: React.ReactNode) =>
    shouldGrowUp ? (
      <div
        className="relative w-full min-w-0 overflow-x-hidden overflow-y-visible"
        style={{ height: allocatedHeightPx }}
      >
        <div
          className="relative w-full min-w-0"
          style={{ top: expandUpTop, height: baseBlockHeightPx }}
        >
          {content}
        </div>
      </div>
    ) : (
      content
    );

  if (posts.length === 1) {
    return renderSinglePostSlotContent(
      props,
      shouldGrowUp,
      wrapExpandUp,
      singleOverlayPayload,
      singleHovered
    );
  }

  return renderMultiPostSlotContent(
    props,
    wrapExpandUp,
    multiHoverLayout.topPx
  );
}
