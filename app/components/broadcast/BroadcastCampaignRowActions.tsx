"use client";

import { Form } from "@remix-run/react";
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Campaign actions"
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
        <Form method="post" className="contents">
          <input type="hidden" name="campaignId" value={campaignId} />
          <DropdownMenuItem asChild>
            <button
              type="submit"
              name="intent"
              value="duplicate"
              className="w-full"
            >
              Duplicate
            </button>
          </DropdownMenuItem>
        </Form>
        {failedCount > 0 && terminal ? (
          <Form method="post" className="contents">
            <input type="hidden" name="campaignId" value={campaignId} />
            <DropdownMenuItem asChild>
              <button
                type="submit"
                name="intent"
                value="retry_failed"
                className="w-full"
              >
                Retry failed recipients
              </button>
            </DropdownMenuItem>
          </Form>
        ) : null}
        {canCancel ? (
          <Form method="post" className="contents">
            <input type="hidden" name="campaignId" value={campaignId} />
            <DropdownMenuItem asChild>
              <button
                type="submit"
                name="intent"
                value="cancel"
                className="w-full"
              >
                Cancel scheduled / in-flight
              </button>
            </DropdownMenuItem>
          </Form>
        ) : null}
        {draftLike ? (
          <Form method="post" className="contents">
            <input type="hidden" name="campaignId" value={campaignId} />
            <DropdownMenuItem asChild>
              <button
                type="submit"
                name="intent"
                value="delete"
                className="w-full"
              >
                Delete draft
              </button>
            </DropdownMenuItem>
          </Form>
        ) : null}
        {terminal && !isArchived ? (
          <Form method="post" className="contents">
            <input type="hidden" name="campaignId" value={campaignId} />
            <DropdownMenuItem asChild>
              <button
                type="submit"
                name="intent"
                value="archive"
                className="w-full"
              >
                Archive
              </button>
            </DropdownMenuItem>
          </Form>
        ) : null}
        {isArchived ? (
          <Form method="post" className="contents">
            <input type="hidden" name="campaignId" value={campaignId} />
            <DropdownMenuItem asChild>
              <button
                type="submit"
                name="intent"
                value="unarchive"
                className="w-full"
              >
                Unarchive
              </button>
            </DropdownMenuItem>
          </Form>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
