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
      <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Create Template</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
            Creating template with {selectedPostsCount} selected post
            {selectedPostsCount !== 1 ? "s" : ""}
          </p>
          <label
            htmlFor="templateName"
            className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Template Name
          </label>
          <input
            type="text"
            id="templateName"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring focus:ring-blue-500/50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400"
            placeholder="Enter template name..."
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateTemplate}
            disabled={!templateName.trim() || templateFetcher.state !== "idle"}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-green-300 dark:bg-green-700 dark:hover:bg-green-600 dark:disabled:bg-green-800"
          >
            {templateFetcher.state !== "idle" ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
