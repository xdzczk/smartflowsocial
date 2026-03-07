/**
 * Keyboard navigation for engagement feed (J/K, R, L, M, E).
 * Tracks focused item index and invokes actions on the focused notification.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface EngagementItemHandlers {
  openReply: () => void;
  like: () => void;
  markDone: () => void;
  expandThread: () => void;
}

export function useEngagementKeyboard(itemCount: number, isActive = true) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const handlersRef = useRef<Map<number, EngagementItemHandlers>>(new Map());

  const registerHandlers = useCallback(
    (index: number, handlers: EngagementItemHandlers | null) => {
      if (handlers === null) {
        handlersRef.current.delete(index);
      } else {
        handlersRef.current.set(index, handlers);
      }
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isActive || itemCount === 0) return;

      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;

      const safeIndex =
        itemCount > 0 ? Math.min(focusedIndex, itemCount - 1) : -1;

      switch (e.key) {
        case "j":
        case "J":
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((i) => (i < itemCount - 1 ? i + 1 : i));
          break;
        case "k":
        case "K":
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((i) => (i > 0 ? i - 1 : i));
          break;
        case "r":
        case "R":
          e.preventDefault();
          handlersRef.current.get(safeIndex)?.openReply();
          break;
        case "l":
        case "L":
          e.preventDefault();
          handlersRef.current.get(safeIndex)?.like();
          break;
        case "m":
        case "M":
          e.preventDefault();
          handlersRef.current.get(safeIndex)?.markDone();
          break;
        case "e":
        case "E":
          e.preventDefault();
          handlersRef.current.get(safeIndex)?.expandThread();
          break;
        default:
          break;
      }
    },
    [isActive, itemCount, focusedIndex]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Derive clamped index so we never expose an out-of-bounds index (avoids setState in effect)
  const focusedIndexClamped =
    itemCount > 0 ? Math.min(Math.max(0, focusedIndex), itemCount - 1) : -1;

  return {
    focusedIndex: focusedIndexClamped,
    setFocusedIndex,
    registerHandlers,
  };
}
