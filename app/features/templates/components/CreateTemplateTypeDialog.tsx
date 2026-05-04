import { useNavigate } from "@remix-run/react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

export interface CreateTemplateTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTemplateTypeDialog({
  open,
  onOpenChange,
}: CreateTemplateTypeDialogProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create template</DialogTitle>
          <DialogDescription>
            Choose a blueprint type. You will define reusable content next - not
            a live post.
          </DialogDescription>
        </DialogHeader>
        <div className="stack-tight pt-2 sm:flex-row">
          <Button
            type="button"
            className="flex-1"
            onClick={() => {
              onOpenChange(false);
              navigate("/dashboard/templates/new/post");
            }}
          >
            Short post
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => {
              onOpenChange(false);
              navigate("/dashboard/templates/new/longform");
            }}
          >
            Article
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
