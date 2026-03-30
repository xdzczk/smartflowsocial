import type { FetcherWithComponents } from "@remix-run/react";
import { formatDistanceToNow } from "date-fns";
import { Repeat } from "lucide-react";

import { Checkbox } from "~/components/ui/checkbox";
import MediaThumbnail from "~/components/ui/MediaThumbnail";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { ContentRowActions } from "~/features/posts/components/ContentTableRow";
import {
  ContentTypeChip,
  PUBLISHING_TABLE_ROW_CLASS,
  QueueStatusChip,
} from "~/features/posts/components/publishing-suite";
import type { CombinedContent, PostFetcher } from "~/features/posts/types";
import {
  formatDate,
  getContentPreview,
  getContentTitle,
  getImageUrls,
  getPostRowThumbnailBadge,
  isRepostContent,
} from "~/features/posts/utils/content-helpers";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { SMALL_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

interface DraftsHybridTableRowProps {
  item: CombinedContent;
  userTimezone?: string;
  userTimeFormat?: "12h" | "24h";
  showBulkActions: boolean;
  selectedItems: Set<string>;
  onToggleSelection?: (id: string) => void;
  onResumeDraft?: () => void;
  draftsActionFetcher?: FetcherWithComponents<{
    success?: boolean;
    newPostId?: string;
    error?: string;
  }>;
  deleteFetcher: PostFetcher;
}

export function DraftsHybridTableRow({
  item,
  userTimezone,
  userTimeFormat = "12h",
  showBulkActions,
  selectedItems,
  onToggleSelection,
  onResumeDraft,
  draftsActionFetcher,
  deleteFetcher,
}: DraftsHybridTableRowProps) {
  const { dateLocale } = useFormattedDate();
  const isRepost = isRepostContent(item);
  const postThumbnailBadge =
    item.type === "longform"
      ? ("ART" as const)
      : getPostRowThumbnailBadge({
          contentKind: "post",
          postType: item.postType,
          signedEvent: item.signedEvent ?? null,
          repost: isRepost,
          postKind: item.postKind ?? null,
        });

  const preview = getContentPreview(item);
  const title = getContentTitle(item);
  const previewTrim = preview?.trim() ?? "";
  const excerpt =
    previewTrim.length > 0 && previewTrim !== title.trim() ? previewTrim : null;

  const updatedDate = item.updatedAt;
  const relativeLabel = formatDistanceToNow(updatedDate, { addSuffix: true });
  const absoluteLabel = formatDate(
    updatedDate,
    false,
    userTimezone,
    userTimeFormat,
    dateLocale
  );

  const mediaCell = (() => {
    if (item.type === "post" && item.fileUrl && item.fileUrl.length > 0) {
      const imageUrls = getImageUrls(item.fileUrl);
      const firstImageUrl = imageUrls.length > 0 ? imageUrls[0] : null;
      if (firstImageUrl) {
        return (
          <div className="relative shrink-0">
            <MediaThumbnail
              src={firstImageUrl}
              alt=""
              className="size-11 rounded-md object-cover sm:size-12"
              fallback={
                <div className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-md text-xs font-medium sm:size-12">
                  {postThumbnailBadge}
                </div>
              }
            />
            {isRepost ? (
              <div className="bg-primary absolute -top-0.5 -right-0.5 rounded-full p-0.5">
                <Repeat
                  className={`${SMALL_ICON_SIZE_CLASS} text-white`}
                  strokeWidth={2}
                  aria-hidden
                />
              </div>
            ) : null}
          </div>
        );
      }
    }
    if (item.type === "longform" && item.image) {
      return (
        <MediaThumbnail
          src={item.image}
          alt=""
          className="size-11 rounded-md object-cover sm:size-12"
          fallback={
            <div className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-md text-xs font-medium sm:size-12">
              ART
            </div>
          }
        />
      );
    }
    return (
      <div className="relative shrink-0">
        <div className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-md text-xs font-medium sm:size-12">
          {postThumbnailBadge}
        </div>
        {isRepost ? (
          <div className="bg-primary absolute -top-0.5 -right-0.5 rounded-full p-0.5">
            <Repeat
              className={`${SMALL_ICON_SIZE_CLASS} text-white`}
              strokeWidth={2}
              aria-hidden
            />
          </div>
        ) : null}
      </div>
    );
  })();

  const isSelected = selectedItems.has(item.id);

  return (
    <tr
      className={cn(
        PUBLISHING_TABLE_ROW_CLASS,
        isSelected && "bg-muted/40 hover:bg-muted/50"
      )}
      onClick={() => onResumeDraft?.()}
    >
      {showBulkActions ? (
        <td className="px-3 py-3 align-middle">
          <Checkbox
            id={`drafts-hybrid-select-${item.id}`}
            checked={selectedItems.has(item.id)}
            onCheckedChange={() => onToggleSelection?.(item.id)}
            onClick={(e) => e.stopPropagation()}
          />
        </td>
      ) : null}
      <td className="px-3 py-3 align-middle whitespace-nowrap">
        <div className="flex max-w-[10rem] items-center gap-3 sm:max-w-none">
          {mediaCell}
          <ContentTypeChip item={item} />
        </div>
      </td>
      <td className="max-w-md px-3 py-3 align-middle whitespace-normal">
        <p className="text-foreground leading-snug font-semibold">{title}</p>
        {excerpt ? (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-relaxed">
            {excerpt}
          </p>
        ) : null}
      </td>
      <td className="text-foreground px-3 py-3 align-middle text-sm whitespace-nowrap">
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <span className="cursor-default tabular-nums underline decoration-dotted underline-offset-4">
              {relativeLabel}
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="border-border bg-popover text-popover-foreground max-w-xs border"
          >
            {absoluteLabel}
          </TooltipContent>
        </Tooltip>
      </td>
      <td className="px-3 py-3 text-center align-middle">
        <div className="flex justify-center">
          <QueueStatusChip queueType={item.queueType} mode="draft" />
        </div>
      </td>
      <td className="px-3 py-3 text-center align-middle">
        <ContentRowActions
          item={item}
          type="draft"
          draftsActionFetcher={draftsActionFetcher}
          deleteFetcher={deleteFetcher}
        />
      </td>
    </tr>
  );
}
