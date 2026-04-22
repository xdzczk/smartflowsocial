import { FileText } from "lucide-react";
import * as React from "react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import {
  addHours,
  formatForDateTimeLocal,
  getNowForDateTimeLocal,
  nowInTimezone,
  parseDateTimeLocal,
  toDate,
} from "~/lib/temporal";

export interface ReplyTemplate {
  id: string;
  slug: string;
  body: string;
}

export type EngagementComposerMode = "reply" | "quote";

const POSTING_LABEL = "Posting...";

const PUBLISH_TOGGLE_ACTIVE = "bg-brand text-brand-on shadow-1";
const PUBLISH_TOGGLE_IDLE =
  "bg-surface-hover/60 text-text-secondary hover:bg-surface-hover";

function useCancelOnEscape(onCancel: () => void) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
}

interface ReplyInputPanelProps {
  replyContent: string;
  isReplying: boolean;
  onContentChange: (content: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  templates?: ReplyTemplate[];
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
    <div className="border-border bg-surface-hover/60 mt-2 rounded-lg border p-2">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={replyContent}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Write your reply... (type / for templates)"
          className="text-text placeholder:text-text-tertiary focus-visible:ring-focus-ring w-full resize-none rounded-xs border-0 bg-transparent p-2 text-sm focus-visible:ring-2"
          rows={3}
        />
        {showSlashMenu && filteredBySlash.length > 0 ? (
          <ul
            className="bg-surface-overlay text-text border-border shadow-2 absolute top-12 right-2 left-2 z-10 max-h-40 overflow-auto rounded-md border py-1"
            role="listbox"
          >
            {filteredBySlash.map((t) => (
              <li key={t.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="hover:bg-surface-hover w-full px-3 py-1.5 text-left text-sm"
                  onClick={() => insertBody(t.body, true)}
                >
                  <span className="font-medium">/{t.slug}</span>
                  {t.body.length > 40 ? (
                    <span className="text-text-secondary ml-1">
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
                className="text-text-secondary hover:bg-surface-hover hover:text-text rounded-lg px-2 py-1 text-xs font-medium"
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
          className="text-text-secondary hover:bg-surface-hover hover:text-text rounded-lg px-3 py-1 text-xs font-medium"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={isReplying || !replyContent.trim()}
          className="bg-brand text-brand-on hover:bg-brand/90 rounded-lg px-3 py-1 text-xs font-medium disabled:opacity-50"
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
        className="text-text placeholder:text-text-tertiary focus-visible:ring-focus-ring w-full resize-none rounded-xs border-0 bg-transparent p-2 text-sm focus-visible:ring-2"
        rows={3}
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="text-text-secondary hover:bg-surface-hover hover:text-text rounded-lg px-3 py-1 text-xs font-medium"
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
  mode: EngagementComposerMode;
  onModeChange: (mode: EngagementComposerMode) => void;
  value: string;
  onValueChange: (value: string) => void;
  isSubmitting: boolean;
  userTimezone?: string;
  onPostNow: () => void;
  onSaveDraft: () => void;
  onSchedule: (scheduledForIso: string) => void;
  onCancel: () => void;
  templates?: ReplyTemplate[];
  trayRef?: React.RefObject<HTMLDivElement | null>;
}

export function UnifiedEngagementComposer({
  mode,
  onModeChange,
  value,
  onValueChange,
  isSubmitting,
  userTimezone = "UTC",
  onPostNow,
  onSaveDraft,
  onSchedule,
  onCancel,
  templates = [],
  trayRef,
}: UnifiedEngagementComposerProps) {
  const tz = userTimezone.trim() || "UTC";
  const [publishMode, setPublishMode] = React.useState<"now" | "schedule">(
    "now"
  );
  const [scheduleLocal, setScheduleLocal] = React.useState(() =>
    formatForDateTimeLocal(addHours(nowInTimezone(tz), 1), tz)
  );

  useCancelOnEscape(onCancel);

  const placeholder =
    mode === "reply" ? "Write your reply…" : "Add your comment…";

  const canSubmit = value.trim().length > 0;

  const handlePrimary = () => {
    if (!canSubmit) return;
    if (publishMode === "now") {
      onPostNow();
      return;
    }
    const zdt = parseDateTimeLocal(scheduleLocal, tz);
    onSchedule(toDate(zdt).toISOString());
  };

  const showSpinner = isSubmitting && publishMode === "now";
  const primaryButtonText = showSpinner
    ? POSTING_LABEL
    : publishMode === "now"
      ? "Post now"
      : "Schedule";

  return (
    <div
      ref={trayRef}
      data-testid="engagement-response-tray"
      className="border-border/70 bg-surface-hover/15 mt-1 border-t px-3 pt-2 pb-3"
      role="region"
      aria-label="Response tray"
    >
      <div className="ring-border mb-2 inline-flex rounded-md p-0.5 ring-1">
        <button
          type="button"
          onClick={() => onModeChange("reply")}
          className={`rounded-xs px-2.5 py-1 text-xs font-medium ${
            mode === "reply" ? PUBLISH_TOGGLE_ACTIVE : PUBLISH_TOGGLE_IDLE
          }`}
        >
          Reply
        </button>
        <button
          type="button"
          onClick={() => onModeChange("quote")}
          className={`rounded-xs px-2.5 py-1 text-xs font-medium ${
            mode === "quote" ? PUBLISH_TOGGLE_ACTIVE : PUBLISH_TOGGLE_IDLE
          }`}
        >
          Quote
        </button>
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {(
          [
            ["now", "Now"],
            ["schedule", "Schedule"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPublishMode(key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              publishMode === key ? PUBLISH_TOGGLE_ACTIVE : PUBLISH_TOGGLE_IDLE
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="border-border/80 bg-canvas/80 rounded-md border px-2 py-2">
        <textarea
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (publishMode === "now" && canSubmit && !isSubmitting) {
                onPostNow();
              }
            }
          }}
          placeholder={placeholder}
          className="text-text placeholder:text-text-tertiary focus-visible:ring-focus-ring min-h-[88px] w-full resize-y rounded-sm border-0 bg-transparent px-1.5 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
          rows={4}
        />
      </div>

      {publishMode === "schedule" ? (
        <div className="mt-2.5">
          <Input
            type="datetime-local"
            value={scheduleLocal}
            min={getNowForDateTimeLocal(tz)}
            onChange={(e) => setScheduleLocal(e.target.value)}
            className="bg-surface-hover/40 border-border h-9 max-w-xs text-sm"
            aria-label="Schedule for"
          />
        </div>
      ) : null}

      <div className="border-border/60 mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        <Button
          type="button"
          size="sm"
          disabled={!canSubmit || (publishMode === "now" && isSubmitting)}
          onClick={() => handlePrimary()}
        >
          {primaryButtonText}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-text-secondary"
          onClick={() => onSaveDraft()}
          disabled={!canSubmit}
        >
          Save draft
        </Button>
        {templates.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-text-secondary gap-1"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden />
                Templates
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-text-secondary ml-auto"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
      <p className="text-text-secondary/80 mt-1.5 text-[10px] leading-tight">
        {publishMode === "now" ? "⌘/Ctrl+Enter to post now" : null}
      </p>
    </div>
  );
}

export interface RepostEngagementTrayProps {
  userTimezone?: string;
  isSubmitting: boolean;
  trayRef?: React.RefObject<HTMLDivElement | null>;
  onRepostNow: () => void;
  onScheduleRepost: (scheduledForIso: string) => void;
  onCancel: () => void;
}

export function RepostEngagementTray({
  userTimezone = "UTC",
  isSubmitting,
  trayRef,
  onRepostNow,
  onScheduleRepost,
  onCancel,
}: RepostEngagementTrayProps) {
  const tz = userTimezone.trim() || "UTC";
  const [publishMode, setPublishMode] = React.useState<"now" | "schedule">(
    "now"
  );
  const [scheduleLocal, setScheduleLocal] = React.useState(() =>
    formatForDateTimeLocal(addHours(nowInTimezone(tz), 1), tz)
  );

  useCancelOnEscape(onCancel);

  const handlePrimary = () => {
    if (publishMode === "now") {
      onRepostNow();
      return;
    }
    const zdt = parseDateTimeLocal(scheduleLocal, tz);
    onScheduleRepost(toDate(zdt).toISOString());
  };

  const showSpinner = isSubmitting && publishMode === "now";
  const primaryLabel =
    publishMode === "schedule" ? "Schedule repost" : "Repost now";

  return (
    <div
      ref={trayRef}
      data-testid="engagement-repost-tray"
      className="border-border/70 bg-surface-hover/10 mt-1 border-t px-3 pt-2 pb-3"
      role="region"
      aria-label="Repost tray"
    >
      <div className="mb-2 flex flex-wrap gap-1">
        {(
          [
            ["now", "Now"],
            ["schedule", "Schedule"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPublishMode(key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              publishMode === key ? PUBLISH_TOGGLE_ACTIVE : PUBLISH_TOGGLE_IDLE
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {publishMode === "schedule" ? (
        <div className="mb-3">
          <Input
            type="datetime-local"
            value={scheduleLocal}
            min={getNowForDateTimeLocal(tz)}
            onChange={(e) => setScheduleLocal(e.target.value)}
            className="bg-surface-hover/40 border-border h-9 max-w-xs text-sm"
            aria-label="Schedule repost for"
          />
        </div>
      ) : null}

      <div className="border-border/60 flex flex-wrap items-center gap-2 border-t pt-3">
        <Button
          type="button"
          size="sm"
          disabled={publishMode === "now" ? isSubmitting : false}
          onClick={() => handlePrimary()}
        >
          {showSpinner ? POSTING_LABEL : primaryLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-text-secondary ml-auto"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
