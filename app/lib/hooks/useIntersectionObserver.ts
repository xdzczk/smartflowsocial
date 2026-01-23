/**
 * Intersection Observer Hook
 * Detects when an element enters or exits the viewport
 * Useful for infinite scroll implementations
 */

import { useEffect, useRef, useState } from "react";

interface UseIntersectionObserverOptions {
  threshold?: number;
  root?: Element | null;
  rootMargin?: string;
}

/**
 * Hook to observe when an element intersects with the viewport
 * @param options - Intersection Observer options
 * @returns Object with ref callback and isIntersecting state
 *
 * @example
 * ```tsx
 * const { ref, isIntersecting } = useIntersectionObserver({ threshold: 0.8 });
 *
 * useEffect(() => {
 *   if (isIntersecting) {
 *     fetchNextPage();
 *   }
 * }, [isIntersecting]);
 *
 * return <div ref={ref}>Sentinel element</div>;
 * ```
 */
export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
) {
  const { threshold = 0.8, root = null, rootMargin = "0px" } = options;
  const [isIntersecting, setIsIntersecting] = useState(false);
  const elementRef = useRef<Element | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setIsIntersecting(entry.isIntersecting);
        }
      },
      {
        threshold,
        root,
        rootMargin,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, root, rootMargin]);

  const ref = (node: Element | null) => {
    elementRef.current = node;
  };

  return { ref, isIntersecting };
}
