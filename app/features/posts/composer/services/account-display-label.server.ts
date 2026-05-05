/**
 * Account label for composer "Editing mode" callouts (matches header / profile display).
 */

import { formatNpubShort } from "~/lib/nostr-conversion";

export function getAccountDisplayLabel(user: unknown): string {
  const fallback = "@current-account";
  if (!user || typeof user !== "object") return fallback;

  const userObj = user as {
    username?: unknown;
    name?: unknown;
    npub?: unknown;
    nostrProfile?: unknown;
  };

  let profileName: string | undefined;
  let profileDisplayName: string | undefined;

  try {
    const parsedProfile: unknown =
      typeof userObj.nostrProfile === "string"
        ? (JSON.parse(userObj.nostrProfile) as unknown)
        : userObj.nostrProfile;
    if (
      parsedProfile &&
      typeof parsedProfile === "object" &&
      !Array.isArray(parsedProfile)
    ) {
      const profileObj = parsedProfile as {
        name?: unknown;
        display_name?: unknown;
      };
      profileName =
        typeof profileObj.name === "string" && profileObj.name.trim().length > 0
          ? profileObj.name.trim()
          : undefined;
      profileDisplayName =
        typeof profileObj.display_name === "string" &&
        profileObj.display_name.trim().length > 0
          ? profileObj.display_name.trim()
          : undefined;
    }
  } catch {
    // Ignore invalid profile JSON and continue with safe fallbacks.
  }

  if (profileDisplayName) return profileDisplayName;
  if (profileName) return profileName;

  if (
    typeof userObj.username === "string" &&
    userObj.username.trim().length > 0
  )
    return userObj.username.trim();
  if (typeof userObj.name === "string" && userObj.name.trim().length > 0)
    return userObj.name.trim();

  if (typeof userObj.npub === "string" && userObj.npub.trim().length > 0) {
    return formatNpubShort(userObj.npub.trim());
  }

  return fallback;
}
