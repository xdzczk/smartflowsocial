import { Link } from "@remix-run/react";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Textarea } from "~/components/ui/textarea";

import { useLookupSheetWide } from "./useLookupSheetWide";

export interface LookupReplyComposerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authorDisplayName: string;
  onSend: (content: string) => Promise<void>;
  isSending: boolean;
  sendError: string | null;
  onClearSendError: () => void;
}

export function LookupReplyComposerDrawer({
  open,
  onOpenChange,
  authorDisplayName,
  onSend,
  isSending,
  sendError,
  onClearSendError,
}: LookupReplyComposerDrawerProps) {
  const wide = useLookupSheetWide();
  const [draft, setDraft] = useState("");

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      onClearSendError();
    }
    onOpenChange(next);
    if (!next) {
      setDraft("");
    }
  };

  const submit = async () => {
    onClearSendError();
    try {
      await onSend(draft);
      toast.success("Reply sent.");
      setDraft("");
      onOpenChange(false);
    } catch {
      /* error surfaced via sendError from parent */
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={
          wide
            ? "flex w-full max-w-lg flex-col gap-0 p-0 sm:max-w-lg"
            : "flex max-h-[90vh] flex-col gap-0 rounded-t-xl p-0"
        }
      >
        <SheetHeader className="border-border space-y-1 border-b px-4 py-3 text-left">
          <SheetTitle className="text-base">Reply</SheetTitle>
          <SheetDescription asChild>
            <p className="text-text-secondary text-sm">
              Replying to{" "}
              <span className="text-text font-medium">
                {authorDisplayName.trim() || "author"}
              </span>
            </p>
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 px-4 py-3">
          <Textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (sendError) onClearSendError();
            }}
            placeholder="Write your reply…"
            className="min-h-[160px] resize-y text-[15px]"
            disabled={isSending}
            aria-invalid={!!sendError}
          />
          {sendError ? (
            <p className="text-danger mt-2 text-xs" role="alert">
              {sendError}
            </p>
          ) : null}
        </div>
        <SheetFooter className="border-border flex-row justify-end gap-2 border-t px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSending}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isSending || !draft.trim()}
            onClick={() => void submit()}
          >
            {isSending ? "Sending…" : "Send reply"}
          </Button>
        </SheetFooter>
        <p className="text-text-secondary px-4 pb-3 text-[11px]">
          Need relays or signing? Check{" "}
          <Link
            to="/dashboard/settings?tab=relays"
            className="text-link hover:text-link-hover underline-offset-2 hover:underline"
          >
            Settings
          </Link>
          .
        </p>
      </SheetContent>
    </Sheet>
  );
}
