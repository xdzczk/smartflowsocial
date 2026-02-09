import { useFetcher } from "@remix-run/react";
import { FileText, List } from "lucide-react";
import { useEffect } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

export type DraftPickerType = "short" | "longform" | "bulk";

interface DraftPickerModalProps {
  open: boolean;
  onClose: () => void;
  type: DraftPickerType;
  onSelect: (id: string) => void;
}

function previewText(text: string | null | undefined, maxLen: number): string {
  if (!text || typeof text !== "string") return "Untitled";
  const t = text.trim();
  return t.length <= maxLen ? t : t.slice(0, maxLen) + "…";
}

export function DraftPickerModal({
  open,
  onClose,
  type,
  onSelect,
}: DraftPickerModalProps) {
  const fetcher = useFetcher<{
    posts?: Array<{
      id: string;
      caption?: string | null;
      content?: string | null;
    }>;
    longformPosts?: Array<{ id: string; title?: string | null }>;
    bulkDraftGroups?: Array<{ id: string; postCount: number }>;
  }>();

  useEffect(() => {
    if (open && fetcher.state === "idle" && !fetcher.data) {
      fetcher.load("/dashboard/drafts");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetcher identity changes; we only want to react to state/data
  }, [open, fetcher.state, fetcher.data]);

  const data = fetcher.data;
  const posts = data?.posts ?? [];
  const longformPosts = data?.longformPosts ?? [];
  const bulkGroups = data?.bulkDraftGroups ?? [];

  const handleSelect = (id: string) => {
    onSelect(id);
    onClose();
  };

  const title =
    type === "short"
      ? "Open short draft"
      : type === "longform"
        ? "Open longform draft"
        : "Open bulk draft";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[80vh] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {fetcher.state === "loading" && !data ? (
            <p className="text-muted-foreground text-sm">Loading drafts…</p>
          ) : type === "short" ? (
            <ul className="space-y-1">
              {posts.length === 0 ? (
                <li className="text-muted-foreground text-sm">
                  No short drafts.
                </li>
              ) : (
                posts.map((p) => (
                  <li key={p.id}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-start gap-2 font-normal"
                      onClick={() => handleSelect(p.id)}
                    >
                      <FileText className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="truncate">
                        {previewText(p.caption ?? p.content, 60)}
                      </span>
                    </Button>
                  </li>
                ))
              )}
            </ul>
          ) : type === "longform" ? (
            <ul className="space-y-1">
              {longformPosts.length === 0 ? (
                <li className="text-muted-foreground text-sm">
                  No longform drafts.
                </li>
              ) : (
                longformPosts.map((p) => (
                  <li key={p.id}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-start gap-2 font-normal"
                      onClick={() => handleSelect(p.id)}
                    >
                      <FileText className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="truncate">
                        {previewText(p.title, 60)}
                      </span>
                    </Button>
                  </li>
                ))
              )}
            </ul>
          ) : (
            <ul className="space-y-1">
              {bulkGroups.length === 0 ? (
                <li className="text-muted-foreground text-sm">
                  No bulk drafts.
                </li>
              ) : (
                bulkGroups.map((g) => (
                  <li key={g.id}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-start gap-2 font-normal"
                      onClick={() => handleSelect(g.id)}
                    >
                      <List className="h-4 w-4 shrink-0" aria-hidden />
                      <span>
                        {g.postCount} {g.postCount === 1 ? "post" : "posts"}
                      </span>
                    </Button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
