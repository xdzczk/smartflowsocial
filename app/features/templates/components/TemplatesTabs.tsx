/**
 * Templates tabs component
 */

interface TemplatesTabsProps {
  activeTab: "assets" | "upload";
  onTabChange: (tab: "assets" | "upload") => void;
}

export function TemplatesTabs({ activeTab, onTabChange }: TemplatesTabsProps) {
  return (
    <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
      <nav className="-mb-px flex space-x-8">
        <button
          onClick={() => onTabChange("assets")}
          className={`border-b-2 px-1 pb-4 text-sm font-medium ${
            activeTab === "assets"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          Assets
        </button>
        <button
          onClick={() => onTabChange("upload")}
          className={`border-b-2 px-1 pb-4 text-sm font-medium ${
            activeTab === "upload"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          Upload
        </button>
      </nav>
    </div>
  );
}










