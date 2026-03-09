/**
 * Article Details (collapsible) for Long-form Composer v2.
 * Default collapsed. Summary, tags, cover image. Soft metadata, non-blocking.
 */

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Separator } from "~/components/ui/separator";
import {
  LongFormCoverImage,
  LongFormPostFields,
} from "~/features/posts/longform";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";

interface ArticleDetailsCollapsibleProps {
  summary: string;
  customTags: string;
  content: string;
  onSummaryChange: (value: string) => void;
  onCustomTagsChange: (value: string) => void;
  onGenerateSummary: () => void;
  image: string;
  uploadError: string;
  uploadProvider: string | null;
  uploadFetcherState: "idle" | "submitting" | "loading";
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onOpenAssetBrowser: () => void;
}

export function ArticleDetailsCollapsible({
  summary,
  customTags,
  content,
  onSummaryChange,
  onCustomTagsChange,
  onGenerateSummary,
  image,
  uploadError,
  uploadProvider,
  uploadFetcherState,
  onImageUpload,
  onRemoveImage,
  onOpenAssetBrowser,
}: ArticleDetailsCollapsibleProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-6">
      <div className="border-border/60 border-b">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="text-foreground dark:text-foreground hover:bg-muted/50 flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
          aria-expanded={open}
        >
          <span>Article details</span>
          <ChevronDown
            className={`${INLINE_ICON_SIZE_CLASS} transition-transform ${open ? "rotate-180" : ""}`}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
        </button>
        {open ? (
          <>
            <Separator className="my-4" />
            <div className="border-border/50 space-y-6 px-4 py-4">
              <LongFormPostFields
                title=""
                summary={summary}
                customTags={customTags}
                content={content}
                onTitleChange={() => {}}
                onSummaryChange={onSummaryChange}
                onCustomTagsChange={onCustomTagsChange}
                onGenerateSummary={onGenerateSummary}
                includeTitle={false}
                softLabels={true}
              />
              <LongFormCoverImage
                image={image}
                uploadError={uploadError}
                uploadProvider={uploadProvider}
                uploadFetcherState={uploadFetcherState}
                onImageUpload={onImageUpload}
                onRemove={onRemoveImage}
                onOpenAssetBrowser={onOpenAssetBrowser}
                softLabel={true}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
