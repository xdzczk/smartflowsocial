/**
 * Keyboard navigation for engagement feed (J/K, R, L, M, E).
 * Tracks focused item index and invokes actions on the focused notification.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface EngagementItemHandlers {
  openReply: () => void;
  openQuote?: () => void;
  openRepost?: () => void;
  like: () => void;
  markDone: () => void;
  ignore?: () => void;
  snooze?: () => void;
  publishNow?: () => void;
  schedule?: () => void;
  expandThread: () => void;
}

export function useEngagementKeyboard(itemCount: number, isActive = true) {
  /** -1 = no row focused (resting feed); 0..n-1 = keyboard focus */
  const [focusedIndex, setFocusedIndex] = useState(-1);
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
        itemCount === 0 || focusedIndex < 0
          ? -1
          : Math.min(focusedIndex, itemCount - 1);

      switch (e.key) {
        case "j":
        case "J":
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((i) => {
            if (i < itemCount - 1) {
              return i < 0 ? 0 : i + 1;
            }
            return i;
          });
          break;
        case "k":
        case "K":
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((i) => {
            if (i > 0) return i - 1;
            if (i === 0) return -1;
            return i;
          });
          break;
        case "r":
        case "R":
          if (safeIndex < 0) return;
          e.preventDefault();
          handlersRef.current.get(safeIndex)?.openReply();
          break;
        case "l":
        case "L":
          if (safeIndex < 0) return;
          e.preventDefault();
          handlersRef.current.get(safeIndex)?.like();
          break;
        case "q":
        case "Q":
          if (safeIndex < 0) return;
          e.preventDefault();
          handlersRef.current.get(safeIndex)?.openQuote?.();
          break;
        case "p":
        case "P":
          if (safeIndex < 0) return;
          e.preventDefault();
          handlersRef.current.get(safeIndex)?.openRepost?.();
          break;
        case "m":
        case "M":
          if (safeIndex < 0) return;
          e.preventDefault();
          handlersRef.current.get(safeIndex)?.markDone();
          break;
        case "i":
        case "I":
          if (safeIndex < 0) return;
          e.preventDefault();
          handlersRef.current.get(safeIndex)?.ignore?.();
          break;
        case "z":
        case "Z":
          if (safeIndex < 0) return;
          e.preventDefault();
          handlersRef.current.get(safeIndex)?.snooze?.();
          break;
        case "Enter":
          if (e.metaKey || e.ctrlKey) {
            if (safeIndex < 0) return;
            e.preventDefault();
            if (e.shiftKey) {
              handlersRef.current.get(safeIndex)?.schedule?.();
            } else {
              handlersRef.current.get(safeIndex)?.publishNow?.();
            }
          }
          break;
        case "e":
        case "E":
          if (safeIndex < 0) return;
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

  // -1 = none; else clamp to [0, itemCount - 1]
  const focusedIndexClamped =
    itemCount === 0 || focusedIndex < 0
      ? -1
      : Math.min(focusedIndex, itemCount - 1);

  return {
    focusedIndex: focusedIndexClamped,
    setFocusedIndex,
    registerHandlers,
  };
}
