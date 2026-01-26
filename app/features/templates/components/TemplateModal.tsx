import { useFetcher } from "@remix-run/react";
import { useState } from "react";
interface TemplateModalProps {
  selectedPostsCount: number;
  selectedPostIds: string[];
  onClose: () => void;
  onSubmit?: (templateName: string) => void;
}

export default function TemplateModal({
  selectedPostsCount,
  selectedPostIds,
  onClose,
  onSubmit,
}: TemplateModalProps) {
  const [templateName, setTemplateName] = useState("");
  const templateFetcher = useFetcher();

  const handleCreateTemplate = () => {
    if (!templateName.trim()) return;

    if (onSubmit) {
      onSubmit(templateName.trim());
      return;
    }

    const formData = new FormData();
    formData.append("_action", "createTemplate");
    formData.append("postIds", JSON.stringify(selectedPostIds));
    formData.append("templateName", templateName.trim());

    templateFetcher.submit(formData, { method: "post" });
  };

  return (
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="dark:bg-card w-full max-w-md rounded-lg bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Create Template</h2>
          <button
            onClick={onClose}
            className="dark:text-muted-foreground dark:hover:text-foreground text-muted-foreground hover:text-muted-foreground"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <p className="dark:text-muted-foreground text-foreground mb-2 text-sm">
            Creating template with {selectedPostsCount} selected post
            {selectedPostsCount !== 1 ? "s" : ""}
          </p>
          <label
            htmlFor="templateName"
            className="dark:text-foreground text-muted-foreground mb-2 block text-sm font-medium"
          >
            Template Name
          </label>
          <input
            type="text"
            id="templateName"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="dark:border-border dark:bg-card dark:text-foreground dark:focus:border-primary border-border text-foreground focus:border-primary focus:ring-primary/50 w-full rounded-lg border px-3 py-2 focus:ring"
            placeholder="Enter template name..."
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="dark:border-border dark:text-foreground dark:hover:bg-muted border-border text-muted-foreground hover:bg-muted rounded-lg border px-4 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateTemplate}
            disabled={!templateName.trim() || templateFetcher.state !== "idle"}
            className="bg-success hover:bg-success/90 dark:bg-success dark:hover:bg-success rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:disabled:opacity-50"
          >
            {templateFetcher.state !== "idle" ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
