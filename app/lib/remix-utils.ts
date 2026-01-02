import { useMatches } from "@remix-run/react";
import { useMemo } from "react";

import type { User } from "~/models/user.server";
const DEFAULT_REDIRECT = "/";

/**
 * This should be used any time the redirect path is user-provided
 * (Like the query string on our login/signup pages). This avoids
 * open-redirect vulnerabilities.
 * @param {string} to The redirect destination
 * @param {string} defaultRedirect The redirect to use if the to is unsafe.
 */
export function safeRedirect(
  to: FormDataEntryValue | string | null | undefined,
  defaultRedirect: string = DEFAULT_REDIRECT,
) {
  if (!to || typeof to !== "string") {
    return defaultRedirect;
  }

  if (!to.startsWith("/") || to.startsWith("//")) {
    return defaultRedirect;
  }

  return to;
}

/**
 * This base hook is used in other hooks to quickly search for specific data
 * across all loader data using useMatches.
 * @param {string} id The route id
 * @returns {JSON|undefined} The router data or undefined if not found
 */
export function useMatchesData(
  id: string,
): Record<string, unknown> | undefined {
  const matchingRoutes = useMatches();
  const route = useMemo(
    () => matchingRoutes.find((route) => route.id === id),
    [matchingRoutes, id],
  );
  const data = route?.data;
  // Type guard to ensure data is an object and not an error type
  if (data && typeof data === "object" && !(data instanceof Error)) {
    return data as Record<string, unknown>;
  }
  return undefined;
}

function isUser(user: unknown): user is User {
  return (
    user != null &&
    typeof user === "object" &&
    "npub" in user &&
    typeof user.npub === "string"
  );
}

export function useOptionalUser(): User | undefined {
  const data = useMatchesData("root");

  // Type guard: ensure data is not an error type and has user property
  if (
    !data ||
    typeof data !== "object" ||
    "error" in data ||
    !("user" in data)
  ) {
    return undefined;
  }

  const user = data.user;
  if (!isUser(user)) {
    return undefined;
  }

  return user;
}

export function useUser(): User {
  const maybeUser = useOptionalUser();
  if (!maybeUser) {
    throw new Error(
      "No user found in root loader, but user is required by useUser. If user is optional, try useOptionalUser instead.",
    );
  }
  return maybeUser;
}

export function validateEmail(npub: unknown): npub is string {
  return typeof npub === "string" && npub.length > 3 && npub.includes("@");
}
