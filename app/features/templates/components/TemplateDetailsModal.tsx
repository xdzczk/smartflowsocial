import { formatDate } from "~/lib/helpers";
interface Template {
  id: string;
  name: string;
  text: string | null;
  imageUrl: string | null;
  createdAt: string | Date;
}

interface TemplateDetailsModalProps {
  template: Template;
  onClose: () => void;
}

export function TemplateDetailsModal({
  template,
  onClose,
}: TemplateDetailsModalProps) {
  return (
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="dark:bg-card relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6">
        <button
          onClick={onClose}
          className="dark:text-muted-foreground dark:hover:text-foreground text-muted-foreground hover:text-muted-foreground absolute top-4 right-4"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <h2 className="mb-4 text-xl font-bold">{template.name}</h2>

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
            <p className="text-muted-foreground dark:text-foreground whitespace-pre-wrap">
              {template.text}
            </p>
          </div>
        ) : null}

        <div className="dark:text-muted-foreground text-muted-foreground text-sm">
          Created: {formatDate(template.createdAt)}
        </div>
      </div>
    </div>
  );
}
