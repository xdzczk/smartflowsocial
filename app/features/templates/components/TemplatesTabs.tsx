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
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "dark:text-muted-foreground dark:hover:text-foreground text-muted-foreground hover:border-border hover:text-muted-foreground border-transparent"
          }`}
        >
          Assets
        </button>
        <button
          onClick={() => onTabChange("upload")}
          className={`border-b-2 px-1 pb-4 text-sm font-medium ${
            activeTab === "upload"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "dark:text-muted-foreground dark:hover:text-foreground text-muted-foreground hover:border-border hover:text-muted-foreground border-transparent"
          }`}
        >
          Upload
        </button>
      </nav>
    </div>
  );
}
