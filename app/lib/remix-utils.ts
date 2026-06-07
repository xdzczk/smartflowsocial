import {
  useMatches,
  useNavigation,
  useRouteLoaderData,
} from "@remix-run/react";
import { useMemo, useState } from "react";

import type { User } from "~/features/user";
import type { loader as rootLoader } from "~/root";
import type { loader as dashboardLoader } from "~/routes/dashboard";
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
  defaultRedirect: string = DEFAULT_REDIRECT
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
  id: string
): Record<string, unknown> | undefined {
  const matchingRoutes = useMatches();
  const route = useMemo(
    () => matchingRoutes.find((route) => route.id === id),
    [matchingRoutes, id]
  );
  const data = route?.data;
  // Type guard to ensure data is an object and not an error type
  if (data && typeof data === "object" && !(data instanceof Error)) {
    return data as Record<string, unknown>;
  }
  return undefined;
}

/** Typed root route loader data (`useRouteLoaderData("root")`). */
export function useRootRouteLoaderData() {
  return useRouteLoaderData<typeof rootLoader>("root");
}

/** Typed dashboard layout loader data (`useRouteLoaderData("routes/dashboard")`). */
export function useDashboardRouteLoaderData() {
  return useRouteLoaderData<typeof dashboardLoader>("routes/dashboard");
}

function isUser(user: unknown): user is User {
  return (
    user != null &&
    typeof user === "object" &&
    "npub" in user &&
    typeof user.npub === "string"
  );
}

/**
 * Returns the current user from loader data. Prefers root loader; falls back to
 * dashboard (or other parent) loader so the profile badge and user-dependent UI
 * render correctly after sign-in and on first paint when root data may not be
 * ready yet (e.g. streaming or hydration).
 * Retains the last known user while navigation is in progress so the header
 * (e.g. account switcher) does not disappear during client-side route changes.
 */
export function useOptionalUser(): User | undefined {
  const matches = useMatches();
  const navigation = useNavigation();

  const userFromMatches = useMemo(() => {
    // Prefer root loader (canonical source)
    const rootData = matches.find((m) => m.id === "root")?.data;
    if (
      rootData &&
      typeof rootData === "object" &&
      !(rootData instanceof Error) &&
      !("error" in rootData) &&
      "user" in rootData
    ) {
      const u = (rootData as Record<string, unknown>)["user"];
      if (isUser(u)) return u;
    }

    // Fallback: user from dashboard (or any parent) when under /dashboard so
    // header badge and composer have user before root data is available
    for (const match of matches) {
      const data = match.data;
      if (
        data &&
        typeof data === "object" &&
        !(data instanceof Error) &&
        "user" in data
      ) {
        const u = (data as Record<string, unknown>)["user"];
        if (isUser(u)) return u;
      }
    }
    return;
  }, [matches]);

  const [lastKnownUser, setLastKnownUser] = useState<User | undefined>();

  // Sync last-known user during render (no refs/effects): keep showing it while navigation is loading
  if (userFromMatches) {
    if (lastKnownUser !== userFromMatches) setLastKnownUser(userFromMatches);
    return userFromMatches;
  }
  if (navigation.state === "loading" && lastKnownUser) return lastKnownUser;
  if (lastKnownUser !== undefined) setLastKnownUser(undefined);
  return undefined;
}

export function useUser(): User {
  const maybeUser = useOptionalUser();
  if (!maybeUser) {
    throw new Error(
      "No user found in root loader, but user is required by useUser. If user is optional, try useOptionalUser instead."
    );
  }
  return maybeUser;
}

export function validateEmail(npub: unknown): npub is string {
  return typeof npub === "string" && npub.length > 3 && npub.includes("@");
}
