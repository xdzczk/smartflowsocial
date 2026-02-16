import { useState } from "react";

import { useFormattedDate } from "~/lib/hooks/useFormattedDate";

import { CompactPostBlock } from "./CompactPostBlock";
import { FullPostBlock } from "./FullPostBlock";
import { MinimalPostBlock } from "./MinimalPostBlock";
import type { PostBlockProps } from "./PostBlock.types";
import { getQueueColorStyle, getDisplayTime } from "./PostBlock.utils";
import { ThumbnailPostBlock } from "./ThumbnailPostBlock";

export function PostBlock({
  post,
  compact = false,
  minimal = false,
  thumbnailOnly = false,
  multipleInCell = false,
  user,
  queueTypes,
  onEdit,
  isLongform = false,
  isPast = false,
  hideVideoPlayButton = false,
  timeLabel,
}: PostBlockProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStarted, setDragStarted] = useState(false);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    // Disable dragging for past posts
    if (isPast) {
      e.preventDefault();
      return;
    }
    setIsDragging(true);
    setDragStarted(true);
    e.dataTransfer.setData("text/plain", JSON.stringify(post));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    // Reset drag started after a small delay to prevent click event
    setTimeout(() => setDragStarted(false), 100);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Don't trigger click if we just finished dragging
    if (dragStarted) {
      return;
    }

    if (onEdit) {
      onEdit(post);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick(e as unknown as React.MouseEvent<HTMLDivElement>);
    }
  };

  const { formatDate, userTimezone } = useFormattedDate();
  const displayTime = getDisplayTime(post, isLongform, isPast);
  const timeString = formatDate(displayTime, {
    dateFormatOptions: {
      hour: "2-digit",
      minute: "2-digit",
    },
  });

  const queueColorStyle = getQueueColorStyle(
    post,
    queueTypes,
    isLongform,
    isPast
  );

  const baseProps = {
    post,
    user,
    queueTypes,
    onEdit,
    isLongform,
    isPast,
    isDragging,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onClick: handleClick,
    onKeyDown: handleKeyDown,
  };

  if (thumbnailOnly) {
    return (
      <ThumbnailPostBlock
        {...baseProps}
        queueColorStyle={queueColorStyle}
        userTimezone={userTimezone}
      />
    );
  }

  if (minimal) {
    return (
      <MinimalPostBlock
        {...baseProps}
        queueColorStyle={queueColorStyle}
        userTimezone={userTimezone}
        multipleInCell={multipleInCell}
        hideVideoPlayButton={hideVideoPlayButton}
        timeLabel={timeLabel}
      />
    );
  }

  if (compact) {
    return (
      <CompactPostBlock
        {...baseProps}
        queueColorStyle={queueColorStyle}
        userTimezone={userTimezone}
        timeString={timeString}
      />
    );
  }

  return (
    <FullPostBlock
      {...baseProps}
      queueColorStyle={queueColorStyle}
      userTimezone={userTimezone}
      timeString={timeString}
      hideVideoPlayButton={hideVideoPlayButton}
    />
  );
}
