import { Link } from "@remix-run/react";
import { FileText, Pencil, Trash2, X } from "lucide-react";

import { Button } from "~/components/ui/button";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";

interface Template {
  id: string;
  name: string;
  text: string | null;
  imageUrl: string | null;
  createdAt: string | Date;
  /** "POST" | "LONGFORM" for Use this template link */
  templateType?: string;
  /** Article title for longform templates (optional) */
  longformTitle?: string | null;
}

interface TemplateDetailsModalProps {
  template: Template;
  onClose: () => void;
  /** Called when user clicks Delete; parent should submit delete action then close */
  onDelete?: (templateId: string) => void;
  /** When true, Delete button is disabled (e.g. delete in progress) */
  isDeleting?: boolean;
}

export function TemplateDetailsModal({
  template,
  onClose,
  onDelete,
  isDeleting = false,
}: TemplateDetailsModalProps) {
  const { formatDate } = useFormattedDate();

  const useTemplateHref =
    template.templateType === "LONGFORM"
      ? `/dashboard/compose/article?templateId=${encodeURIComponent(template.id)}`
      : `/dashboard/compose?type=post&templateId=${encodeURIComponent(template.id)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 z-0 bg-black/80"
        aria-hidden
        onClick={onClose}
      />
      <div className="dark:bg-card relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
        <button
          onClick={onClose}
          className="dark:text-muted-foreground dark:hover:text-foreground text-muted-foreground hover:text-muted-foreground absolute top-4 right-4"
          aria-label="Close"
        >
          <X className="h-6 w-6" strokeWidth={INLINE_ICON_STROKE} aria-hidden />
        </button>

        <h2 className="mb-4 text-xl font-bold">{template.name}</h2>

        {template.longformTitle && template.longformTitle !== template.name ? (
          <p className="dark:text-muted-foreground text-muted-foreground mb-2 text-sm">
            Article: {template.longformTitle}
          </p>
        ) : null}

        {template.imageUrl ? (
          <div className="mb-4">
            <img
              src={template.imageUrl}
              alt={template.name}
              className="max-h-64 w-full rounded object-cover"
            />
          </div>
        ) : null}

        {template.text ? (
          <div className="mb-4">
            <h3 className="mb-2 font-semibold">Content</h3>
            <p className="dark:text-foreground text-muted-foreground max-h-48 overflow-y-auto text-sm whitespace-pre-wrap">
              {template.text}
            </p>
          </div>
        ) : null}

        <div className="dark:text-muted-foreground text-muted-foreground mb-6 text-sm">
          Created: {formatDate(template.createdAt)}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="default" className="gap-2">
            <Link to={useTemplateHref} onClick={onClose}>
              <FileText className="h-4 w-4" />
              Use this template
            </Link>
          </Button>
          <Button asChild variant="secondary" className="gap-2">
            <Link
              to={`/dashboard/templates/edit/${template.id}`}
              onClick={onClose}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </Button>
          {onDelete ? (
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              onClick={() => {
                onDelete(template.id);
                onClose();
              }}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
