/**
 * Lifecycle Manager for PWA
 * Handles app visibility, page lifecycle, and state persistence
 */

interface LifecycleState {
  route?: string;
  selectedPostId?: string;
  modalState?: {
    isOpen: boolean;
    type?: string;
  };
  lastSyncTimestamp?: number;
}

const STORAGE_KEY = "pwa-lifecycle-state";

/**
 * Persist minimal UI state to sessionStorage
 */
export function persistUIState(state: Partial<LifecycleState>): void {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return;
  }

  try {
    const existing = getPersistedState();
    const merged = { ...existing, ...state };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (error) {
    console.warn("Failed to persist UI state:", error);
  }
}

/**
 * Get persisted UI state from sessionStorage
 */
export function getPersistedState(): LifecycleState {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return {};
  }

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn("Failed to get persisted UI state:", error);
    return {};
  }
}

/**
 * Clear persisted UI state
 */
export function clearPersistedState(): void {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return;
  }

  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear persisted UI state:", error);
  }
}

/**
 * Initialize lifecycle handlers
 * Sets up visibility change, page hide/show, and focus/blur handlers
 */
export function initLifecycleHandlers(options: {
  onVisibilityChange?: (isVisible: boolean) => void;
  onPageShow?: () => void;
  onPageHide?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const { onVisibilityChange, onPageShow, onPageHide, onFocus, onBlur } =
    options;

  // Handle visibility changes
  const handleVisibilityChange = () => {
    const isVisible = !document.hidden;
    onVisibilityChange?.(isVisible);

    // Persist state when going to background
    if (!isVisible) {
      persistUIState({
        route: window.location.pathname,
      });
    }
  };

  // Handle page show (including back/forward navigation)
  const handlePageShow = (_event: PageTransitionEvent) => {
    // Persisted state is restored from sessionStorage
    onPageShow?.();
  };

  // Handle page hide
  const handlePageHide = () => {
    persistUIState({
      route: window.location.pathname,
    });
    onPageHide?.();
  };

  // Handle window focus
  const handleFocus = () => {
    onFocus?.();
  };

  // Handle window blur
  const handleBlur = () => {
    onBlur?.();
  };

  // Register event listeners
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pageshow", handlePageShow);
  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("focus", handleFocus);
  window.addEventListener("blur", handleBlur);

  // Return cleanup function
  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("pageshow", handlePageShow);
    window.removeEventListener("pagehide", handlePageHide);
    window.removeEventListener("focus", handleFocus);
    window.removeEventListener("blur", handleBlur);
  };
}

/**
 * Check if page was hidden and is now visible again
 */
export function wasPageHidden(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  // Check if we have a persisted state, indicating we were hidden
  const state = getPersistedState();
  return Object.keys(state).length > 0;
}
