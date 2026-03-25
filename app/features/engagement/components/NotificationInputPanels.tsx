import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export interface ReplyTemplate {
  id: string;
  slug: string;
  body: string;
}

const MODE_ACTIVE_CLASS = "bg-primary text-primary-foreground";
const MODE_INACTIVE_CLASS = "bg-muted text-muted-foreground";
const POSTING_LABEL = "Posting...";

interface ReplyInputPanelProps {
  replyContent: string;
  isReplying: boolean;
  onContentChange: (content: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  /** Reply templates for slash-command or Insert template button */
  templates?: ReplyTemplate[];
  /** Called when user inserts a template body (e.g. append to content) */
  onInsertTemplate?: (body: string) => void;
}

export function ReplyInputPanel({
  replyContent,
  isReplying,
  onContentChange,
  onSubmit,
  onCancel,
  templates = [],
  onInsertTemplate,
}: ReplyInputPanelProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [slashFilter, setSlashFilter] = React.useState<string | null>(null);
  const [showSlashMenu, setShowSlashMenu] = React.useState(false);

  const filteredBySlash =
    slashFilter !== null
      ? templates.filter((t) =>
          t.slug.toLowerCase().includes(slashFilter.toLowerCase())
        )
      : templates;

  const handleTextChange = (value: string) => {
    onContentChange(value);
    const lastSlash = value.lastIndexOf("/");
    if (lastSlash === -1) {
      setShowSlashMenu(false);
      setSlashFilter(null);
      return;
    }
    const afterSlash = value.slice(lastSlash + 1);
    const hasSpaceOrNewline = /\s/.test(afterSlash);
    if (hasSpaceOrNewline || lastSlash > 0) {
      setShowSlashMenu(false);
      setSlashFilter(null);
      return;
    }
    if (templates.length > 0) {
      setShowSlashMenu(true);
      setSlashFilter(afterSlash);
    }
  };

  const insertBody = (body: string, replaceSlash = false) => {
    if (replaceSlash && slashFilter !== null && textareaRef.current) {
      const lastSlash = replyContent.lastIndexOf("/");
      const before = replyContent.slice(0, lastSlash);
      const after = replyContent.slice(lastSlash + 1 + slashFilter.length);
      onContentChange(before + body + after);
    } else if (onInsertTemplate) {
      onInsertTemplate(body);
    } else {
      onContentChange(replyContent + body);
    }
    setShowSlashMenu(false);
    setSlashFilter(null);
    textareaRef.current?.focus();
  };

  return (
    <div className="border-border bg-secondary/30 mt-2 rounded-lg border p-2">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={replyContent}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Write your reply... (type / for templates)"
          className="text-foreground placeholder:text-muted-foreground focus:ring-ring w-full resize-none rounded border-0 bg-transparent p-2 text-sm focus:ring-2"
          rows={3}
        />
        {showSlashMenu && filteredBySlash.length > 0 ? (
          <ul
            className="bg-popover text-popover-foreground border-border absolute top-12 right-2 left-2 z-10 max-h-40 overflow-auto rounded-md border py-1 shadow-md"
            role="listbox"
          >
            {filteredBySlash.map((t) => (
              <li key={t.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="hover:bg-muted w-full px-3 py-1.5 text-left text-sm"
                  onClick={() => insertBody(t.body, true)}
                >
                  <span className="font-medium">/{t.slug}</span>
                  {t.body.length > 40 ? (
                    <span className="text-muted-foreground ml-1">
                      — {t.body.slice(0, 40)}…
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {templates.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg px-2 py-1 text-xs font-medium"
              >
                Insert template
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {templates.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onSelect={() => insertBody(t.body, false)}
                >
                  /{t.slug}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <button
          onClick={onCancel}
          className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg px-3 py-1 text-xs font-medium"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={isReplying || !replyContent.trim()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-3 py-1 text-xs font-medium disabled:opacity-50"
        >
          {isReplying ? POSTING_LABEL : "Post Reply"}
        </button>
      </div>
    </div>
  );
}

interface QuoteInputPanelProps {
  quoteContent: string;
  originalContent: string;
  isQuoting: boolean;
  onContentChange: (content: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function QuoteInputPanel({
  quoteContent,
  originalContent,
  isQuoting,
  onContentChange,
  onSubmit,
  onCancel,
}: QuoteInputPanelProps) {
  const truncatedOriginal =
    originalContent.length > 50
      ? originalContent.substring(0, 50) + "..."
      : originalContent;

  return (
    <div className="border-success/30 bg-success/10 mt-2 rounded-lg border p-2">
      <div className="text-success dark:text-success mb-2 text-xs">
        Quoting: <span className="italic">&quot;{truncatedOriginal}&quot;</span>
      </div>
      <textarea
        value={quoteContent}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder="Add your thoughts on this reply..."
        className="text-foreground placeholder:text-muted-foreground focus:ring-ring w-full resize-none rounded border-0 bg-transparent p-2 text-sm focus:ring-2"
        rows={3}
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg px-3 py-1 text-xs font-medium"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={isQuoting || !quoteContent.trim()}
          className="bg-success hover:bg-success/90 dark:bg-success dark:hover:bg-success rounded-lg px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {isQuoting ? POSTING_LABEL : "Post Quote"}
        </button>
      </div>
    </div>
  );
}

interface UnifiedEngagementComposerProps {
  mode: "reply" | "quote" | "repost-note";
  onModeChange: (mode: "reply" | "quote" | "repost-note") => void;
  value: string;
  onValueChange: (value: string) => void;
  isSubmitting: boolean;
  onSubmitNow: () => void;
  onSchedule: () => void;
  onSaveDraft: () => void;
  onAddToQueue: () => void;
  onCancel: () => void;
  templates?: ReplyTemplate[];
}

export function UnifiedEngagementComposer({
  mode,
  onModeChange,
  value,
  onValueChange,
  isSubmitting,
  onSubmitNow,
  onSchedule,
  onSaveDraft,
  onAddToQueue,
  onCancel,
  templates = [],
}: UnifiedEngagementComposerProps) {
  return (
    <div className="border-border bg-secondary/30 mt-2 rounded-lg border p-2">
      <div className="mb-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onModeChange("reply")}
          className={`rounded-full px-2 py-1 text-xs ${
            mode === "reply" ? MODE_ACTIVE_CLASS : MODE_INACTIVE_CLASS
          }`}
        >
          Reply
        </button>
        <button
          type="button"
          onClick={() => onModeChange("quote")}
          className={`rounded-full px-2 py-1 text-xs ${
            mode === "quote" ? MODE_ACTIVE_CLASS : MODE_INACTIVE_CLASS
          }`}
        >
          Quote reply
        </button>
        <button
          type="button"
          onClick={() => onModeChange("repost-note")}
          className={`rounded-full px-2 py-1 text-xs ${
            mode === "repost-note" ? MODE_ACTIVE_CLASS : MODE_INACTIVE_CLASS
          }`}
        >
          Repost with note
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder="Write your response..."
        className="text-foreground placeholder:text-muted-foreground focus:ring-ring w-full resize-none rounded border-0 bg-transparent p-2 text-sm focus:ring-2"
        rows={3}
      />
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        {templates.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg px-2 py-1 text-xs font-medium"
              >
                Insert template
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {templates.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onSelect={() => onValueChange(value + t.body)}
                >
                  /{t.slug}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg px-3 py-1 text-xs font-medium"
        >
          Cancel
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSaveDraft}
            className="text-muted-foreground hover:bg-muted rounded-lg px-3 py-1 text-xs font-medium"
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={onAddToQueue}
            className="text-muted-foreground hover:bg-muted rounded-lg px-3 py-1 text-xs font-medium"
          >
            Add to queue
          </button>
          <button
            type="button"
            onClick={onSchedule}
            className="text-muted-foreground hover:bg-muted rounded-lg px-3 py-1 text-xs font-medium"
          >
            Schedule
          </button>
          <button
            type="button"
            onClick={onSubmitNow}
            disabled={isSubmitting || !value.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-3 py-1 text-xs font-medium disabled:opacity-50"
          >
            {isSubmitting ? POSTING_LABEL : "Post now"}
          </button>
        </div>
      </div>
    </div>
  );
}
