import { useEffect, useState, startTransition } from "react";

/**
 * Returns true when viewport width is at or below the given breakpoint (px).
 * SSR-safe: defaults to false so desktop layout renders first.
 */
export function useIsMobile(breakpointPx = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${breakpointPx}px)`).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const fn = () => {
      startTransition(() => {
        setIsMobile(mq.matches);
      });
    };
    // Set initial value via transition to avoid synchronous setState
    startTransition(() => {
      setIsMobile(mq.matches);
    });
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [breakpointPx]);

  return isMobile;
}
