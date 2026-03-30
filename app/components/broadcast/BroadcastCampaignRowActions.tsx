"use client";

import { useFetcher } from "@remix-run/react";
import { MoreHorizontal } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";

const BROADCASTS_INDEX_ACTION = "/dashboard/broadcasts";

type BroadcastCampaignStatus =
  | "DRAFT"
  | "AWAITING_SIGNATURE"
  | "SCHEDULED"
  | "QUEUED"
  | "SENDING"
  | "COMPLETED"
  | "COMPLETED_WITH_FAILURES"
  | "PAUSED"
  | "FAILED"
  | "CANCELLED";

export function BroadcastCampaignRowActions(props: {
  campaignId: string;
  status: BroadcastCampaignStatus;
  isArchived: boolean;
  totalRecipients: number;
  failedCount: number;
}) {
  const { campaignId, status, isArchived, totalRecipients, failedCount } =
    props;
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";

  const draftLike = status === "DRAFT" || status === "AWAITING_SIGNATURE";
  const canPreSignReview = draftLike && totalRecipients > 0;
  const canCancel =
    status === "SCHEDULED" ||
    status === "QUEUED" ||
    status === "SENDING" ||
    status === "PAUSED";
  const terminal =
    status === "COMPLETED" ||
    status === "COMPLETED_WITH_FAILURES" ||
    status === "FAILED" ||
    status === "CANCELLED";

  function postIntent(intent: string) {
    fetcher.submit(
      { intent, campaignId },
      { method: "post", action: BROADCASTS_INDEX_ACTION }
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Campaign actions"
          disabled={busy}
        >
          <MoreHorizontal className={INLINE_ICON_SIZE_CLASS} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <a href={`/dashboard/broadcasts/${campaignId}`}>View</a>
        </DropdownMenuItem>
        {canPreSignReview ? (
          <DropdownMenuItem asChild>
            <a
              href={`/dashboard/broadcasts/new/review?campaignId=${encodeURIComponent(campaignId)}`}
            >
              Review &amp; sign
            </a>
          </DropdownMenuItem>
        ) : null}
        {draftLike ? (
          <DropdownMenuItem asChild>
            <a
              href={`/dashboard/broadcasts/new?campaignId=${encodeURIComponent(campaignId)}`}
            >
              {totalRecipients > 0 ? "Edit before sign" : "Edit draft"}
            </a>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          disabled={busy}
          onSelect={() => {
            postIntent("duplicate");
          }}
        >
          Duplicate
        </DropdownMenuItem>
        {failedCount > 0 && terminal ? (
          <DropdownMenuItem
            className="cursor-pointer"
            disabled={busy}
            onSelect={() => {
              postIntent("retry_failed");
            }}
          >
            Retry failed recipients
          </DropdownMenuItem>
        ) : null}
        {canCancel ? (
          <DropdownMenuItem
            className="cursor-pointer"
            disabled={busy}
            onSelect={() => {
              postIntent("cancel");
            }}
          >
            Cancel scheduled / in-flight
          </DropdownMenuItem>
        ) : null}
        {draftLike ? (
          <DropdownMenuItem
            className="cursor-pointer"
            disabled={busy}
            onSelect={() => {
              postIntent("delete");
            }}
          >
            Delete draft
          </DropdownMenuItem>
        ) : null}
        {terminal && !isArchived ? (
          <DropdownMenuItem
            className="cursor-pointer"
            disabled={busy}
            onSelect={() => {
              postIntent("archive");
            }}
          >
            Archive
          </DropdownMenuItem>
        ) : null}
        {isArchived ? (
          <DropdownMenuItem
            className="cursor-pointer"
            disabled={busy}
            onSelect={() => {
              postIntent("unarchive");
            }}
          >
            Unarchive
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
