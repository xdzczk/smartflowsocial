interface ReplyInputPanelProps {
  replyContent: string;
  isReplying: boolean;
  onContentChange: (content: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function ReplyInputPanel({
  replyContent,
  isReplying,
  onContentChange,
  onSubmit,
  onCancel,
}: ReplyInputPanelProps) {
  return (
    <div className="border-border bg-secondary/30 mt-2 rounded-lg border p-2">
      <textarea
        value={replyContent}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder="Write your reply..."
        className="text-foreground placeholder:text-muted-foreground focus:ring-primary w-full resize-none rounded border-0 bg-transparent p-2 text-sm focus:ring-2"
        rows={3}
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="text-muted-foreground hover:bg-accent/10 hover:text-foreground rounded-lg px-3 py-1 text-xs font-medium"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={isReplying || !replyContent.trim()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-3 py-1 text-xs font-medium disabled:opacity-50"
        >
          {isReplying ? "Posting..." : "Post Reply"}
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
    <div className="mt-2 rounded-lg border border-green-500/30 bg-green-500/10 p-2">
      <div className="mb-2 text-xs text-green-600 dark:text-green-400">
        Quoting: <span className="italic">&quot;{truncatedOriginal}&quot;</span>
      </div>
      <textarea
        value={quoteContent}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder="Add your thoughts on this reply..."
        className="text-foreground placeholder:text-muted-foreground w-full resize-none rounded border-0 bg-transparent p-2 text-sm focus:ring-2 focus:ring-green-500"
        rows={3}
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="text-muted-foreground hover:bg-accent/10 hover:text-foreground rounded-lg px-3 py-1 text-xs font-medium"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={isQuoting || !quoteContent.trim()}
          className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 dark:bg-green-500 dark:hover:bg-green-600"
        >
          {isQuoting ? "Posting..." : "Post Quote"}
        </button>
      </div>
    </div>
  );
}
