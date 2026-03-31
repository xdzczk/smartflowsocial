import { useFetcher, useRevalidator } from "@remix-run/react";
import { Pencil, Trash2 } from "lucide-react";
import { startTransition, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { ManagementListSection } from "~/features/settings/components/patterns";

interface ReplyTemplateRecord {
  id: string;
  slug: string;
  body: string;
}

interface ReplyTemplatesSettingsProps {
  templates: ReplyTemplateRecord[];
}

interface FetcherData {
  success?: boolean;
  error?: string;
}

export function ReplyTemplatesSettings({
  templates,
}: ReplyTemplatesSettingsProps) {
  const templateFetcher = useFetcher<FetcherData>();
  const deleteFetcher = useFetcher<FetcherData>();
  const revalidator = useRevalidator();
  const revalidatorRef = useRef(revalidator);
  useEffect(() => {
    revalidatorRef.current = revalidator;
  }, [revalidator]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ReplyTemplateRecord | null>(
    null
  );

  const lastTemplateModeRef = useRef<"create" | "edit">("create");

  useEffect(() => {
    if (
      (templateFetcher.state === "idle" && templateFetcher.data?.success) ||
      (deleteFetcher.state === "idle" && deleteFetcher.data?.success)
    ) {
      revalidatorRef.current.revalidate();
    }
  }, [
    templateFetcher.state,
    templateFetcher.data?.success,
    deleteFetcher.state,
    deleteFetcher.data?.success,
  ]);

  const wasTemplateSubmittingRef = useRef(false);
  useEffect(() => {
    const wasSubmitting = wasTemplateSubmittingRef.current;
    wasTemplateSubmittingRef.current = templateFetcher.state === "submitting";
    if (!wasSubmitting || templateFetcher.state !== "idle") return;
    if (templateFetcher.data?.success) {
      toast.success(
        lastTemplateModeRef.current === "edit"
          ? "Template saved"
          : "Template created"
      );
      startTransition(() => setDialogOpen(false));
    } else if (templateFetcher.data?.error) {
      toast.error(templateFetcher.data.error);
    }
  }, [templateFetcher.state, templateFetcher.data]);

  const wasDeletingRef = useRef(false);
  useEffect(() => {
    const wasSubmitting = wasDeletingRef.current;
    wasDeletingRef.current = deleteFetcher.state === "submitting";
    if (!wasSubmitting || deleteFetcher.state !== "idle") return;
    if (deleteFetcher.data?.success) toast.success("Template removed");
    else if (deleteFetcher.data?.error) toast.error(deleteFetcher.data.error);
  }, [deleteFetcher.state, deleteFetcher.data]);

  const openCreate = () => {
    lastTemplateModeRef.current = "create";
    setEditingId(null);
    setSlug("");
    setBody("");
    setDialogOpen(true);
  };

  const openEdit = (t: ReplyTemplateRecord) => {
    lastTemplateModeRef.current = "edit";
    setEditingId(t.id);
    setSlug(t.slug);
    setBody(t.body);
    setDialogOpen(true);
  };

  const busy = templateFetcher.state !== "idle";

  const handleSaveTemplate = () => {
    lastTemplateModeRef.current = editingId ? "edit" : "create";
    const fd = new FormData();
    if (editingId) {
      fd.set("_action", "reply_template_update");
      fd.set("id", editingId);
      fd.set("slug", slug);
      fd.set("body", body);
    } else {
      fd.set("_action", "reply_template_create");
      fd.set("slug", slug);
      fd.set("body", body);
    }
    templateFetcher.submit(fd, {
      method: "post",
      action: "/dashboard/settings",
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const fd = new FormData();
    fd.set("_action", "reply_template_delete");
    fd.set("id", deleteTarget.id);
    deleteFetcher.submit(fd, { method: "post", action: "/dashboard/settings" });
    setDeleteTarget(null);
  };

  return (
    <>
      <ManagementListSection
        title="Reply templates"
        description="Reusable snippets for engagement replies. Type / in the reply box to insert one by slug."
        primaryAction={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={openCreate}
          >
            New template
          </Button>
        }
      >
        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <p className="text-foreground text-sm font-medium">
              No reply templates yet
            </p>
            <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
              Create reusable snippets for faster replies in the engagement
              feed.
            </p>
            <Button type="button" size="sm" onClick={openCreate}>
              Create first template
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {templates.map((t) => (
              <li
                key={t.id}
                className="border-border/60 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-sm font-medium">/{t.slug}</div>
                  <p className="text-muted-foreground mt-0.5 truncate text-sm">
                    {t.body}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => openEdit(t)}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                    aria-label={`Delete template /${t.slug}`}
                    onClick={() => setDeleteTarget(t)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ManagementListSection>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit template" : "New template"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="tmpl-slug">Slug</Label>
              <Input
                id="tmpl-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. thanks"
                className="font-mono text-sm"
                disabled={busy}
              />
              <p className="text-muted-foreground text-xs">
                In the reply box, type /slug to insert this template.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tmpl-body">Body</Label>
              <Textarea
                id="tmpl-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Template text…"
                disabled={busy}
                rows={4}
              />
            </div>
            {templateFetcher.data?.error ? (
              <p className="text-destructive text-sm">
                {templateFetcher.data.error}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveTemplate}
              disabled={busy || !slug.trim() || !body.trim()}
            >
              {busy
                ? "Saving…"
                : editingId
                  ? "Save changes"
                  : "Create template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Remove /${deleteTarget.slug}? This cannot be undone.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
