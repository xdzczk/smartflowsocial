import { useEffect, useMemo, useRef, useState } from "react";

import type { QueueType } from "~/features/posts/types";

import { getEffectiveHashtagsForSubmit } from "../components/composer/composer-submit-utils";

const DEBOUNCE_MS = 400;

/**
 * Mirrors submit-time hashtag resolution: when a preset is active, tags come from the
 * composer field; otherwise `/api/effective-hashtags` merges queue defaults.
 */
export function useEffectiveHashtagsForPreview(input: {
  useHashtagPresets: boolean;
  selectedHashtags: string;
  selectedQueue: string;
  queueTypes: Array<string | QueueType>;
  userId: string | undefined;
  defaultTags: string[];
}): string {
  const {
    useHashtagPresets,
    selectedHashtags,
    selectedQueue,
    queueTypes,
    userId,
    defaultTags,
  } = input;

  const [fetchedLine, setFetchedLine] = useState<string>(selectedHashtags);
  const reqIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stableDefaultTags = useMemo(() => [...defaultTags], [defaultTags]);

  useEffect(() => {
    if (useHashtagPresets) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    queueMicrotask(() => {
      setFetchedLine(selectedHashtags);
    });

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const id = ++reqIdRef.current;
      void (async () => {
        try {
          const line = await getEffectiveHashtagsForSubmit(
            false,
            selectedHashtags,
            selectedQueue,
            queueTypes,
            userId,
            stableDefaultTags
          );
          if (reqIdRef.current === id) {
            setFetchedLine(line);
          }
        } catch {
          if (reqIdRef.current === id) {
            setFetchedLine(stableDefaultTags.join(" ").trim());
          }
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [
    useHashtagPresets,
    selectedHashtags,
    selectedQueue,
    queueTypes,
    userId,
    stableDefaultTags,
  ]);

  return useHashtagPresets ? selectedHashtags : fetchedLine;
}
