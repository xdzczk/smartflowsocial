import { Bookmark, MoreVertical } from "lucide-react";

import { Button } from "~/components/ui/button";
import { MarkdownPreview } from "~/features/posts/components/MarkdownPreview";
import { BRAND_NAME } from "~/lib/brand";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { formatForDisplay, nowUTC } from "~/lib/temporal";

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
  const { dateLocale } = useFormattedDate();

  if (!isOpen) return null;

  const formatDate = () => {
    const now = nowUTC();
    return formatForDisplay(
      now,
      "UTC",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      },
      undefined,
      dateLocale
    );
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
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        onKeyDown={handleBackdropKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div className="bg-surface-overlay shadow-3 relative mx-4 max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl">
        {/* Header */}
        <div className="border-border dark:border-border flex items-center justify-between border-b p-6">
          <h2 className="text-text text-lg font-semibold">
            Preview: How your post will look
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-text-secondary hover:text-text-secondary dark:text-text dark:hover:text-text"
          >
            ✕ Close
          </Button>
        </div>

        {/* Content */}
        <div className="bg-surface max-h-[calc(90vh-120px)] overflow-y-auto">
          {/* Article Card Preview - matches the Primal/Nostr style */}
          <div className="mx-auto max-w-2xl p-6">
            {/* Author Header */}
            <div className="cluster-loose mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(255,77%,51%)] to-[hsl(255,97%,51%)] text-lg font-semibold text-white">
                {author.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-text font-semibold">{author}</div>
              </div>
              <div className="ml-auto">
                <MoreVertical
                  className="text-text h-6 w-6"
                  strokeWidth={INLINE_ICON_STROKE}
                  aria-hidden
                />
              </div>
            </div>

            {/* Date and Source */}
            <div className="text-text-secondary dark:text-text cluster mb-4 text-sm">
              <span>{formatDate()}</span>
              <span>•</span>
              <span>via {BRAND_NAME}</span>
              <div className="ml-auto">
                <Bookmark
                  className="h-5 w-5"
                  strokeWidth={INLINE_ICON_STROKE}
                  aria-hidden
                />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-text mb-4 text-2xl leading-tight font-bold">
              {title || "Untitled Post"}
            </h1>

            {/* Cover Image */}
            {image ? (
              <div className="mb-4 overflow-hidden rounded-xl">
                <img
                  src={image}
                  alt="Cover"
                  className="h-80 w-full object-cover"
                />
              </div>
            ) : null}

            {/* Summary */}
            {summary ? (
              <div className="dark:bg-surface bg-surface-hover mb-6 rounded-xl p-6">
                <p className="text-text-secondary dark:text-text text-lg leading-relaxed font-medium">
                  {summary}
                </p>
              </div>
            ) : null}

            {/* Full Content */}
            <div
              className="text-text mb-6"
              style={{
                fontSize: "1.1rem",
                lineHeight: "1.7",
                color: "inherit",
              }}
            >
              <MarkdownPreview source={content} />
            </div>

            {/* Zap Button */}
            <div className="cluster-loose">
              {/* Hashtags */}
              {displayedHashtags ? (
                <div className="cluster ml-auto">
                  <span className="text-text-secondary dark:text-text text-xs">
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
