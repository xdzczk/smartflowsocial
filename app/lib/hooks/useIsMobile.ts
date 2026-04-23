import { useEffect, useState } from "react";

/**
 * Returns true when viewport width is at or below the given breakpoint (px).
 *
 * SSR-safe and hydration-safe:
 *  - The initial render (server + first client render during hydration) ALWAYS
 *    returns `false`. Previously this hook tried to read `window.matchMedia`
 *    synchronously inside `useState` which produced different values on the
 *    server (no `window` → false) and on the client (real match result →
 *    potentially true), triggering React hydration mismatches (`#418`/`#423`)
 *    and leaving affected subtrees rendered with the *server* value even
 *    after `useEffect` updated state, because hydration bails out before
 *    committing client updates in some cases.
 *  - The real value is committed in a `useLayoutEffect`-equivalent (a
 *    synchronous `useEffect` that runs immediately after mount). On iOS
 *    Safari and Android Chrome, this runs before the browser paints the
 *    next frame, so the mobile layout kicks in within a single frame of
 *    the initial desktop paint. That flicker is preferable to leaving the
 *    tree wedged in the server's desktop layout.
 *
 * Consumers should write their JSX so that `isMobile === false` produces a
 * layout that is valid on small screens too (even if visually non-ideal for
 * one frame). Do NOT conditionally mount/unmount large subtrees on this
 * value — prefer CSS-driven responsive behavior where possible.
 */
export function useIsMobile(breakpointPx = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [breakpointPx]);

  return isMobile;
}
