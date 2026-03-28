import { useFetcher } from "@remix-run/react";
import { FileText, LayoutTemplate, List } from "lucide-react";
import { useEffect } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import { isThreadDraftPost } from "../utils/draft-post-classification";

export type DraftPickerType = "short" | "longform" | "bulk";

export type ShortDraftFilter = "all" | "poll" | "thread";

export interface DraftsAndTemplatesPickerOptions {
  templates: Array<{ id: string; name: string | null }>;
  onSelectTemplate: (id: string) => void;
  /** When true, only the templates list is shown (no draft fetch). */
  templatesOnly?: boolean;
}

interface DraftPickerModalProps {
  open: boolean;
  onClose: () => void;
  type: DraftPickerType;
  /** Called when a draft is chosen (omit when `draftsAndTemplates.templatesOnly` is true). */
  onSelect?: (id: string) => void;
  /** When set with `templatesOnly`, shows only templates. Omit for drafts-only. */
  draftsAndTemplates?: DraftsAndTemplatesPickerOptions;
  /** When `type` is short, limit listed drafts (default: all). */
  shortDraftFilter?: ShortDraftFilter;
}

function previewText(text: string | null | undefined, maxLen: number): string {
  if (!text || typeof text !== "string") return "Untitled";
  const t = text.trim();
  return t.length <= maxLen ? t : t.slice(0, maxLen) + "…";
}

/* eslint-disable-next-line sonarjs/cognitive-complexity -- three picker types × draft/template-only modes */
export function DraftPickerModal({
  open,
  onClose,
  type,
  onSelect,
  draftsAndTemplates,
  shortDraftFilter = "all",
}: DraftPickerModalProps) {
  const fetcher = useFetcher<{
    posts?: Array<{
      id: string;
      caption?: string | null;
      content?: string | null;
      postType?: string;
      postKind?: string;
      draftMeta?: unknown;
    }>;
    longformPosts?: Array<{ id: string; title?: string | null }>;
    bulkDraftGroups?: Array<{ id: string; postCount: number }>;
  }>();

  const templatesOnly = Boolean(draftsAndTemplates?.templatesOnly);
  const skipDraftsFetch = templatesOnly;

  useEffect(() => {
    if (!open || skipDraftsFetch || fetcher.state !== "idle" || fetcher.data) {
      return;
    }
    fetcher.load("/dashboard/drafts");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetcher identity changes; we only want to react to state/data
  }, [open, skipDraftsFetch, fetcher.state, fetcher.data]);

  const data = fetcher.data;
  const postsRaw = data?.posts ?? [];
  const posts =
    type === "short" && shortDraftFilter !== "all"
      ? postsRaw.filter((p) =>
          shortDraftFilter === "poll"
            ? p.postType === "POLL"
            : isThreadDraftPost(p)
        )
      : postsRaw;
  const longformPosts = data?.longformPosts ?? [];
  const bulkGroups = data?.bulkDraftGroups ?? [];

  const handleSelect = (id: string) => {
    onSelect?.(id);
    onClose();
  };

  const handleSelectTemplate = (id: string) => {
    draftsAndTemplates?.onSelectTemplate(id);
    onClose();
  };

  const baseTitle =
    type === "short"
      ? shortDraftFilter === "poll"
        ? "Open poll draft"
        : shortDraftFilter === "thread"
          ? "Open thread draft"
          : "Open short draft"
      : type === "longform"
        ? "Open article draft"
        : "Open bulk draft";

  const shortDraftsEmptyLabel =
    shortDraftFilter === "poll"
      ? "No poll drafts."
      : shortDraftFilter === "thread"
        ? "No thread drafts."
        : "No short drafts.";

  const templatesList = draftsAndTemplates?.templates ?? [];

  const dialogTitle = templatesOnly ? "Templates" : baseTitle;

  const draftsListContent =
    type === "short" ? (
      <ul className="space-y-1">
        {posts.length === 0 ? (
          <li className="text-muted-foreground text-sm">
            {shortDraftsEmptyLabel}
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
          <li className="text-muted-foreground text-sm">No article drafts.</li>
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
                <span className="truncate">{previewText(p.title, 60)}</span>
              </Button>
            </li>
          ))
        )}
      </ul>
    ) : (
      <ul className="space-y-1">
        {bulkGroups.length === 0 ? (
          <li className="text-muted-foreground text-sm">No bulk drafts.</li>
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
    );

  const templatesPanel = (
    <ul className="space-y-1">
      {templatesList.length === 0 ? (
        <li className="text-muted-foreground text-sm">No templates yet.</li>
      ) : (
        templatesList.map((t) => (
          <li key={t.id}>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start gap-2 font-normal"
              onClick={() => handleSelectTemplate(t.id)}
            >
              <LayoutTemplate className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{t.name ?? "Unnamed template"}</span>
            </Button>
          </li>
        ))
      )}
    </ul>
  );

  const body = templatesOnly ? (
    templatesPanel
  ) : fetcher.state === "loading" && !data ? (
    <p className="text-muted-foreground text-sm">Loading drafts…</p>
  ) : (
    draftsListContent
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[80vh] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          {templatesOnly ? (
            <DialogDescription>
              Load a saved template into the composer.
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
      </DialogContent>
    </Dialog>
  );
}
