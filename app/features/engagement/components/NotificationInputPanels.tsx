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
          {isQuoting ? "Posting..." : "Post Quote"}
        </button>
      </div>
    </div>
  );
}
