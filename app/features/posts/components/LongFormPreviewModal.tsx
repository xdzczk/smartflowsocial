import { Bookmark, MoreVertical } from "lucide-react";

import { Button } from "~/components/ui/button";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { formatForDisplay, nowUTC } from "~/lib/temporal";

import { MarkdownPreview } from "./MarkdownPreview";

interface LongFormPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  summary: string;
  content: string;
  image: string;
  displayedHashtags: string;
  author?: string;
}

export default function LongFormPreviewModal({
  isOpen,
  onClose,
  title,
  summary,
  content,
  image,
  displayedHashtags,
  author = "You",
}: LongFormPreviewModalProps) {
  if (!isOpen) return null;

  const formatDate = () => {
    const now = nowUTC();
    return formatForDisplay(now, "UTC", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleBackdropKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="bg-opacity-50 absolute inset-0 bg-black"
        onClick={onClose}
        onKeyDown={handleBackdropKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div className="dark:bg-card relative mx-4 max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="border-border dark:border-border flex items-center justify-between border-b p-6">
          <h2 className="text-foreground text-lg font-semibold dark:text-white">
            Preview: How your post will look
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-muted-foreground hover:text-muted-foreground dark:text-foreground dark:hover:text-foreground"
          >
            ✕ Close
          </Button>
        </div>

        {/* Content */}
        <div className="dark:bg-card max-h-[calc(90vh-120px)] overflow-y-auto bg-white">
          {/* Article Card Preview - matches the Primal/Nostr style */}
          <div className="mx-auto max-w-2xl p-6">
            {/* Author Header */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(255,77%,51%)] to-[hsl(255,97%,51%)] text-lg font-semibold text-white">
                {author.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-foreground font-semibold dark:text-white">
                  {author}
                </div>
              </div>
              <div className="ml-auto">
                <MoreVertical
                  className="text-foreground h-6 w-6"
                  strokeWidth={INLINE_ICON_STROKE}
                  aria-hidden
                />
              </div>
            </div>

            {/* Date and Source */}
            <div className="text-muted-foreground dark:text-foreground mb-4 flex items-center gap-2 text-sm">
              <span>{formatDate()}</span>
              <span>•</span>
              <span>via SmartFlow</span>
              <div className="ml-auto">
                <Bookmark
                  className="h-5 w-5"
                  strokeWidth={INLINE_ICON_STROKE}
                  aria-hidden
                />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-foreground mb-4 text-2xl leading-tight font-bold dark:text-white">
              {title || "Untitled Post"}
            </h1>

            {/* Cover Image */}
            {image ? (
              <div className="mb-4 overflow-hidden rounded-2xl">
                <img
                  src={image}
                  alt="Cover"
                  className="h-80 w-full object-cover"
                />
              </div>
            ) : null}

            {/* Summary */}
            {summary ? (
              <div className="dark:bg-card bg-muted mb-6 rounded-xl p-6">
                <p className="text-muted-foreground dark:text-foreground text-lg leading-relaxed font-medium">
                  {summary}
                </p>
              </div>
            ) : null}

            {/* Full Content */}
            <div
              className="text-foreground mb-6 dark:text-white"
              style={{
                fontSize: "1.1rem",
                lineHeight: "1.7",
                color: "inherit",
              }}
            >
              <MarkdownPreview source={content} />
            </div>

            {/* Zap Button */}
            <div className="flex items-center gap-3">
              {/* Hashtags */}
              {displayedHashtags ? (
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-muted-foreground dark:text-foreground text-xs">
                    {displayedHashtags}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
