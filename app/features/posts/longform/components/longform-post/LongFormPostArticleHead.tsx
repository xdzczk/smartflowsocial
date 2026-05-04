import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import { Textarea } from "~/components/ui/textarea";
import { ComposerCanvasSectionLabel } from "~/features/posts/composer/components/composer";
import { cn } from "~/lib/utils";
import type { longformPostClientSchema } from "~/lib/validation";

import { LongFormCoverImage } from "../LongFormCoverImage";

type LongformForm = UseFormReturn<z.infer<typeof longformPostClientSchema>>;

export interface LongFormPostArticleHeadProps {
  initialPostId: string | undefined;
  title: string;
  summary: string | undefined;
  content: string | undefined;
  form: LongformForm;
  onGenerateSummary: () => void;
  image: string;
  uploadError: string | null | undefined;
  uploadProvider: string | null;
  uploadFetcherState: "idle" | "submitting" | "loading";
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveCover: () => void;
  mediaUploadBlocked: boolean;
  articleColumnClass: string;
}

export function LongFormPostArticleHead({
  initialPostId,
  title,
  summary,
  content,
  form,
  onGenerateSummary,
  image,
  uploadError,
  uploadProvider,
  uploadFetcherState,
  onImageUpload,
  onRemoveCover,
  mediaUploadBlocked,
  articleColumnClass,
}: LongFormPostArticleHeadProps) {
  return (
    <div className={articleColumnClass}>
      <div className="space-y-6">
        <input
          key={initialPostId ?? "new"}
          type="text"
          id="article-composer-title"
          placeholder="Write a title"
          className="text-text placeholder:text-text-tertiary/40 focus:border-border/25 motion-fast w-full border-0 border-b border-transparent bg-transparent pb-3 text-[1.65rem] leading-[1.15] font-semibold tracking-tight outline-none focus-visible:ring-0 sm:text-[2rem] lg:text-[2.125rem]"
          aria-label="Article title"
          name="title"
          value={title}
          onChange={(e) =>
            form.setValue("title", e.target.value, {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
        />

        <div className="space-y-5 pt-2">
          <div className="text-text-secondary/90 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <ComposerCanvasSectionLabel
                as="label"
                className="mb-0"
                htmlFor="article-composer-summary"
                tone="article"
              >
                Summary
              </ComposerCanvasSectionLabel>
              <button
                type="button"
                className={cn(
                  "motion-fast text-[10px] font-normal underline-offset-2",
                  !content
                    ? "text-text-secondary/35 pointer-events-none cursor-not-allowed"
                    : "text-text-secondary/50 hover:text-text-secondary/70 underline"
                )}
                onClick={onGenerateSummary}
                disabled={!content}
              >
                Auto-generate
              </button>
            </div>
            <Textarea
              id="article-composer-summary"
              name="summary"
              value={summary ?? ""}
              onChange={(e) =>
                form.setValue("summary", e.target.value, {
                  shouldValidate: true,
                })
              }
              placeholder="Short line for previews and search (recommended)."
              rows={2}
              className="border-border-subtle/40 focus-visible:border-border-subtle/60 text-text-secondary motion-fast resize-y rounded-md border-0 border-b bg-transparent px-0 py-2 text-sm leading-relaxed shadow-none focus-visible:ring-0"
            />
          </div>

          <LongFormCoverImage
            image={image}
            uploadError={uploadError ?? ""}
            uploadProvider={uploadProvider}
            uploadFetcherState={uploadFetcherState}
            onImageUpload={(e) => onImageUpload(e)}
            onRemove={onRemoveCover}
            softLabel
            coverFileUploadDisabled={mediaUploadBlocked}
          />
        </div>
      </div>
    </div>
  );
}
