/**
 * Templates tabs component
 */

interface TemplatesTabsProps {
  activeTab: "assets" | "upload";
  onTabChange: (tab: "assets" | "upload") => void;
}

export function TemplatesTabs({ activeTab, onTabChange }: TemplatesTabsProps) {
  return (
    <div className="dark:border-border border-border mb-6 border-b">
      <nav className="-mb-px flex space-x-8">
        <button
          onClick={() => onTabChange("assets")}
          className={`border-b-2 px-1 pb-4 text-sm font-medium ${
            activeTab === "assets"
              ? "border-brand text-text-secondary"
              : "dark:text-text-secondary dark:hover:text-text text-text-secondary hover:border-border hover:text-text-secondary border-transparent"
          }`}
        >
          Templates
        </button>
        <button
          onClick={() => onTabChange("upload")}
          className={`border-b-2 px-1 pb-4 text-sm font-medium ${
            activeTab === "upload"
              ? "border-brand text-text-secondary"
              : "dark:text-text-secondary dark:hover:text-text text-text-secondary hover:border-border hover:text-text-secondary border-transparent"
          }`}
        >
          Upload
        </button>
      </nav>
    </div>
  );
}
