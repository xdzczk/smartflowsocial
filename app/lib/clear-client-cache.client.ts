/**
 * Clear all client-side cache on logout so no data from the previous account
 * can leak into the next session (e.g. when switching accounts on the same device).
 */

/** localStorage keys to keep (device/display preferences, not account data). */
const LOCALSTORAGE_WHITELIST = ["theme"];

/**
 * Clear sessionStorage entirely and remove all localStorage except whitelisted keys.
 * Call this on logout before redirecting so account A's data never appears for account B.
 */
export function clearAllClientCacheOnLogout(): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.clear();
  } catch (error) {
    console.warn("Failed to clear sessionStorage on logout:", error);
  }

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (!LOCALSTORAGE_WHITELIST.includes(key)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn("Failed to clear localStorage on logout:", error);
  }
}
