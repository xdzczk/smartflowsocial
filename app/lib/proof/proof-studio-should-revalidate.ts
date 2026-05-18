import type { ShouldRevalidateFunction } from "@remix-run/react";

/**
 * Proof Studio pages are client-heavy and revalidate on window focus by default.
 * Skipping same-URL revalidation avoids "Load failed" errors on mobile when export
 * opens the download sheet and the deferred loader fetch is interrupted.
 */
export const proofStudioShouldRevalidate: ShouldRevalidateFunction = ({
  formAction,
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) => {
  if (formAction) return true;
  if (
    currentUrl.pathname === nextUrl.pathname &&
    currentUrl.search === nextUrl.search
  ) {
    return false;
  }
  return defaultShouldRevalidate;
};
