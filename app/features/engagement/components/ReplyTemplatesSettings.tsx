import { useFetcher, useRevalidator } from "@remix-run/react";
import { FileText, Trash2 } from "lucide-react";
import { useEffect } from "react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

interface ReplyTemplateRecord {
  id: string;
  slug: string;
  body: string;
}

interface ReplyTemplatesSettingsProps {
  templates: ReplyTemplateRecord[];
}

export function ReplyTemplatesSettings({
  templates,
}: ReplyTemplatesSettingsProps) {
  const createFetcher = useFetcher<{ success?: boolean; error?: string }>();
  const deleteFetcher = useFetcher<{ success?: boolean; error?: string }>();
  const revalidator = useRevalidator();

  useEffect(() => {
    if (
      (createFetcher.state === "idle" && createFetcher.data?.success) ||
      (deleteFetcher.state === "idle" && deleteFetcher.data?.success)
    ) {
      revalidator.revalidate();
    }
  }, [
    createFetcher.state,
    createFetcher.data,
    deleteFetcher.state,
    deleteFetcher.data,
    revalidator,
  ]);

  const isCreating = createFetcher.state === "submitting";
  const createError = createFetcher.data?.error;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" aria-hidden />
          Reply templates
        </CardTitle>
        <CardDescription>
          Short snippets you can insert when replying in the engagement feed.
          Type <kbd className="bg-muted rounded px-1 font-mono text-xs">/</kbd>{" "}
          in the reply box to pick a template by slug (e.g. /thanks).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <createFetcher.Form method="post" className="space-y-3">
          <input type="hidden" name="_action" value="reply_template_create" />
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="reply-template-slug">Slug</Label>
              <Input
                id="reply-template-slug"
                name="slug"
                placeholder="e.g. thanks"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reply-template-body">Body</Label>
              <Input
                id="reply-template-body"
                name="body"
                placeholder="e.g. Thanks for the reply!"
                className="text-sm"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Adding…" : "Add"}
              </Button>
            </div>
          </div>
          {createError ? (
            <p className="text-destructive text-sm">{createError}</p>
          ) : null}
        </createFetcher.Form>

        {templates.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No reply templates yet. Add one above to use /slug in the engagement
            reply box.
          </p>
        ) : (
          <ul className="space-y-2">
            {templates.map((t) => (
              <ReplyTemplateRow
                key={t.id}
                template={t}
                deleteFetcher={deleteFetcher}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ReplyTemplateRow({
  template,
  deleteFetcher,
}: {
  template: ReplyTemplateRecord;
  deleteFetcher: ReturnType<
    typeof useFetcher<{ success?: boolean; error?: string }>
  >;
}) {
  const isDeleting = deleteFetcher.state === "submitting";

  const handleDelete = () => {
    const formData = new FormData();
    formData.set("_action", "reply_template_delete");
    formData.set("id", template.id);
    deleteFetcher.submit(formData, { method: "post" });
  };

  return (
    <li className="border-border bg-muted/30 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
      <div className="min-w-0 flex-1">
        <span className="font-mono text-sm font-medium">/{template.slug}</span>
        <span className="text-muted-foreground ml-2 truncate text-sm">
          {template.body.length > 50
            ? template.body.slice(0, 50) + "…"
            : template.body}
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive h-8 w-8"
        disabled={isDeleting}
        aria-label={`Delete template /${template.slug}`}
        onClick={handleDelete}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>
    </li>
  );
}
