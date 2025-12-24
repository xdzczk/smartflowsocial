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
        <div className="mt-2 rounded-lg border border-gray-300 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-900">
            <textarea
                value={replyContent}
                onChange={(e) => onContentChange(e.target.value)}
                placeholder="Write your reply..."
                className="w-full resize-none rounded border-0 bg-transparent p-2 text-sm focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
                rows={3}
            />
            <div className="flex justify-end gap-2">
                <button
                    onClick={onCancel}
                    className="rounded-lg px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                    Cancel
                </button>
                <button
                    onClick={onSubmit}
                    disabled={isReplying || !replyContent.trim()}
                    className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600"
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
    const truncatedOriginal = originalContent.length > 50
        ? originalContent.substring(0, 50) + "..."
        : originalContent;

    return (
        <div className="mt-2 rounded-lg border border-green-300 bg-green-50 p-2 dark:border-green-600 dark:bg-green-900/30">
            <div className="mb-2 text-xs text-gray-600 dark:text-gray-400">
                Quoting: <span className="italic">"{truncatedOriginal}"</span>
            </div>
            <textarea
                value={quoteContent}
                onChange={(e) => onContentChange(e.target.value)}
                placeholder="Add your thoughts on this reply..."
                className="w-full resize-none rounded border-0 bg-transparent p-2 text-sm focus:ring-2 focus:ring-green-500 dark:text-gray-100"
                rows={3}
            />
            <div className="flex justify-end gap-2">
                <button
                    onClick={onCancel}
                    className="rounded-lg px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                    Cancel
                </button>
                <button
                    onClick={onSubmit}
                    disabled={isQuoting || !quoteContent.trim()}
                    className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 dark:bg-green-700 dark:hover:bg-green-600"
                >
                    {isQuoting ? "Posting..." : "Post Quote"}
                </button>
            </div>
        </div>
    );
}
