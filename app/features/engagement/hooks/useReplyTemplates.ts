import { useFetcher } from "@remix-run/react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface ReplyTemplate {
  id: string;
  slug: string;
  body: string;
}

const API = "/api/engagement/reply-templates";

interface FetcherData {
  templates?: ReplyTemplate[];
  success?: boolean;
}

export function useReplyTemplates(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const fetcher = useFetcher<FetcherData>();
  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
  const didMutateRef = useRef(false);

  const load = useCallback(() => {
    if (enabled) {
      didMutateRef.current = false;
      fetcher.load(API);
    }
  }, [enabled, fetcher]);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.templates) {
      const next = Array.isArray(fetcher.data.templates)
        ? fetcher.data.templates
        : [];
      setTimeout(() => setTemplates(next), 0);
    }
    if (didMutateRef.current && fetcher.data.success) {
      didMutateRef.current = false;
      fetcher.load(API);
    }
  }, [fetcher.state, fetcher.data, fetcher]);

  const createTemplate = useCallback(
    (slug: string, body: string) => {
      didMutateRef.current = true;
      fetcher.submit(
        { action: "create", slug, body },
        { method: "POST", action: API, encType: "application/json" }
      );
    },
    [fetcher]
  );

  const deleteTemplate = useCallback(
    (id: string) => {
      didMutateRef.current = true;
      fetcher.submit(
        { action: "delete", id },
        { method: "POST", action: API, encType: "application/json" }
      );
    },
    [fetcher]
  );

  return {
    templates,
    isLoading: fetcher.state === "loading",
    load,
    createTemplate,
    deleteTemplate,
  };
}
