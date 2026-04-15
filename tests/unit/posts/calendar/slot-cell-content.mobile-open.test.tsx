/**
 * @vitest-environment jsdom
 */
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SlotCellContent } from "~/features/posts/calendar/Calendar/components/SlotCellContent";
import type { SlotState } from "~/features/posts/calendar/Calendar/domain/grid-types";
import type { CalendarPost } from "~/features/posts/calendar/Calendar/PostBlock.types";

vi.mock("~/features/posts/calendar/Calendar/PostBlock", () => ({
  PostBlock: ({
    post,
    onEdit,
  }: {
    post: { id: string };
    onEdit?: (post: CalendarPost) => void;
  }) => (
    <button
      type="button"
      data-testid={`post-block-${post.id}`}
      onClick={() => onEdit?.(post as CalendarPost)}
    >
      Open
    </button>
  ),
}));

function buildSlotState({
  dateKey,
  time,
  posts,
}: {
  dateKey: string;
  time: string;
  posts: CalendarPost[];
}): SlotState {
  return {
    dateKey,
    posts,
    slotKey: `${dateKey}-${time}`,
    isDragOver: false,
    singlePostKey:
      posts.length === 1 ? `${dateKey}-${time}-${posts[0]?.id ?? ""}` : null,
    isHovered: false,
    expandRows: 1,
    blockHeightPx: 48,
    noExpandOnHover: false,
    firstConflictOffsetBelow: null,
    firstConflictOffsetAbove: null,
  };
}

describe("SlotCellContent mobile open behavior", () => {
  it("opens details on single post tap in mobile week slot", () => {
    const post = {
      id: "post-1",
      fileUrl: [],
      caption: "Single post",
    } as unknown as CalendarPost;
    const onPostEdit = vi.fn();
    const setActiveEmptySlotKey = vi.fn();
    const setHoveredPostKey = vi.fn();

    render(
      <SlotCellContent
        slotState={buildSlotState({
          dateKey: "2026-04-15",
          time: "10:00",
          posts: [post],
        })}
        time="10:00"
        rowIndex={20}
        availableRowsBelow={28}
        isMobile={true}
        hoveredPostKey={null}
        setHoveredPostKey={setHoveredPostKey}
        onPostEdit={onPostEdit}
        isLongform={false}
        isAll={false}
        activeEmptySlotKey={null}
        setActiveEmptySlotKey={setActiveEmptySlotKey}
      />
    );

    fireEvent.click(screen.getByTestId("post-block-post-1"));

    expect(onPostEdit).toHaveBeenCalledTimes(1);
    expect(onPostEdit).toHaveBeenCalledWith(post);
    expect(setHoveredPostKey).not.toHaveBeenCalled();
  });

  it("opens details on multi-post tap in mobile week slot", () => {
    const postA = {
      id: "post-a",
      fileUrl: [],
      caption: "A",
    } as unknown as CalendarPost;
    const postB = {
      id: "post-b",
      fileUrl: [],
      caption: "B",
    } as unknown as CalendarPost;
    const onPostEdit = vi.fn();
    const setActiveEmptySlotKey = vi.fn();
    const setHoveredPostKey = vi.fn();

    render(
      <SlotCellContent
        slotState={buildSlotState({
          dateKey: "2026-04-15",
          time: "10:30",
          posts: [postA, postB],
        })}
        time="10:30"
        rowIndex={21}
        availableRowsBelow={27}
        isMobile={true}
        hoveredPostKey={null}
        setHoveredPostKey={setHoveredPostKey}
        onPostEdit={onPostEdit}
        isLongform={false}
        isAll={false}
        activeEmptySlotKey={null}
        setActiveEmptySlotKey={setActiveEmptySlotKey}
      />
    );

    fireEvent.click(screen.getByTestId("post-block-post-b"));

    expect(onPostEdit).toHaveBeenCalledTimes(1);
    expect(onPostEdit).toHaveBeenCalledWith(postB);
    expect(setHoveredPostKey).not.toHaveBeenCalled();
  });
});
