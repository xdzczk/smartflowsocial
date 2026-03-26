/**
 * Persist composer state to localStorage (debounced). Restore on mount when not opening a server draft.
 * Do not restore when initialDraftId/groupId is set — server draft is source of truth.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 1500;

export interface ComposerLocalSnapshot {
  version?: number;
  contentType?: "post" | "thread" | "poll" | "article";
  content: string;
  queueType: string;
  queueTypeId: string | null;
  scheduledFor: string;
  tags: string;
  hashTagPresetId: string | null;
  attachmentMeta: Array<{ localId: string; url: string; alt?: string }>;
  threadSegments?: Array<{
    id: string;
    content: string;
    attachments: Array<{ localId: string; url?: string; alt?: string }>;
  }>;
  threadDelayMinutes?: number;
  savedAt: number;
}

export function useComposerLocalDraft(
  storageKey: string,
  /** When true, do not restore from localStorage and clear any existing key (server draft wins). */
  skipRestore: boolean
) {
  const [restored, setRestored] = useState<ComposerLocalSnapshot | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (skipRestore) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
      queueMicrotask(() => setRestored(null));
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        queueMicrotask(() => setRestored(null));
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (
        parsed &&
        typeof parsed === "object" &&
        "content" in parsed &&
        "savedAt" in parsed
      ) {
        queueMicrotask(() => setRestored(parsed as ComposerLocalSnapshot));
      } else {
        queueMicrotask(() => setRestored(null));
      }
    } catch {
      queueMicrotask(() => setRestored(null));
    }
  }, [storageKey, skipRestore]);

  const saveSnapshot = useCallback(
    (snapshot: Omit<ComposerLocalSnapshot, "savedAt">) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        try {
          const toStore: ComposerLocalSnapshot = {
            ...snapshot,
            savedAt: Date.now(),
          };
          localStorage.setItem(storageKey, JSON.stringify(toStore));
        } catch {
          // ignore quota / private mode
        }
      }, DEBOUNCE_MS);
    },
    [storageKey]
  );

  /** Write snapshot to localStorage immediately (e.g. on unmount or page hide). Cancels any pending debounced save. */
  const flushSnapshot = useCallback(
    (snapshot: Omit<ComposerLocalSnapshot, "savedAt">) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      try {
        const toStore: ComposerLocalSnapshot = {
          ...snapshot,
          savedAt: Date.now(),
        };
        localStorage.setItem(storageKey, JSON.stringify(toStore));
      } catch {
        // ignore quota / private mode
      }
    },
    [storageKey]
  );

  const clearSnapshot = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [storageKey]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  return { restored, saveSnapshot, flushSnapshot, clearSnapshot };
}

/**
 * Generic localStorage draft: persist any JSON-serializable snapshot (debounced).
 * Use for longform and bulk composers.
 */
export function useLocalDraft<T extends { savedAt?: number }>(
  storageKey: string,
  skipRestore: boolean,
  debounceMs = 1500
) {
  const [restored, setRestored] = useState<T | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (skipRestore) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
      queueMicrotask(() => setRestored(null));
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        queueMicrotask(() => setRestored(null));
        return;
      }
      queueMicrotask(() => setRestored(JSON.parse(raw) as T));
    } catch {
      queueMicrotask(() => setRestored(null));
    }
  }, [storageKey, skipRestore]);

  const saveSnapshot = useCallback(
    (snapshot: Omit<T, "savedAt">) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        try {
          /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- T = Omit<T, "savedAt"> & { savedAt: number }, assertion is safe */
          const toStore = { ...snapshot, savedAt: Date.now() } as T;
          localStorage.setItem(storageKey, JSON.stringify(toStore));
        } catch {
          // ignore
        }
      }, debounceMs);
    },
    [storageKey, debounceMs]
  );

  const flushSnapshot = useCallback(
    (snapshot: Omit<T, "savedAt">) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      try {
        /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- T = Omit<T, "savedAt"> & { savedAt: number }, assertion is safe */
        const toStore = { ...snapshot, savedAt: Date.now() } as T;
        localStorage.setItem(storageKey, JSON.stringify(toStore));
      } catch {
        // ignore
      }
    },
    [storageKey]
  );

  const clearSnapshot = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [storageKey]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  return { restored, saveSnapshot, flushSnapshot, clearSnapshot };
}
