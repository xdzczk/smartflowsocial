import { Link } from "@remix-run/react";

import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

export interface ScheduledPostActionBarProps {
  onEdit?: () => void;
  onReschedule?: () => void;
  /** When true, Edit post is shown disabled (e.g. pure repost). */
  editDisabled?: boolean;
  editDisabledReason?: string;
  openFullEditorHref?: string | null;
  openFullEditorLabel?: string;
  deleteForm: React.ReactNode;
  className?: string;
}

/**
 * Consistent footer for scheduled post details: Edit post, Reschedule, optional full editor link, Delete scheduled post.
 */
export function ScheduledPostActionBar({
  onEdit,
  onReschedule,
  editDisabled = false,
  editDisabledReason = "This scheduled item cannot be edited here.",
  openFullEditorHref,
  openFullEditorLabel = "Open in full editor",
  deleteForm,
  className,
}: ScheduledPostActionBarProps) {
  const showEdit = onEdit != null;

  const editButton = (
    <Button
      variant="outline"
      size="sm"
      type="button"
      disabled={editDisabled}
      onClick={editDisabled ? undefined : onEdit}
    >
      Edit post
    </Button>
  );

  return (
    <div
      className={cn(
        "border-border/60 bg-card/95 shrink-0 border-t px-5 py-3 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-muted-foreground min-h-[32px] min-w-0 text-xs">
          {openFullEditorHref ? (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              asChild
            >
              <Link to={openFullEditorHref}>{openFullEditorLabel}</Link>
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {showEdit ? (
            editDisabled ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* Radix: focusable wrapper so tooltips work on disabled controls */}
                    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- see Radix disabled-trigger pattern */}
                    <span className="inline-flex" tabIndex={0}>
                      {editButton}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {editDisabledReason}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              editButton
            )
          ) : null}
          {onReschedule ? (
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={onReschedule}
            >
              Reschedule
            </Button>
          ) : null}
          <div className="border-border/60 ml-1 flex items-center border-l border-dashed pl-3">
            {deleteForm}
          </div>
        </div>
      </div>
    </div>
  );
}
