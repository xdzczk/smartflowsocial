/**
 * Drafts header component showing title and count
 */

interface DraftsHeaderProps {
  currentTab: string;
  allContentCount: number;
  postsCount: number;
  longformCount: number;
}

export function DraftsHeader({
  currentTab,
  allContentCount,
  postsCount,
  longformCount,
}: DraftsHeaderProps) {
  const getCount = () => {
    if (currentTab === "all") return allContentCount;
    if (currentTab === "posts") return postsCount;
    return longformCount;
  };

  const getItemType = () => {
    if (currentTab === "all") return "items";
    if (currentTab === "posts") return "posts";
    return "longform articles";
  };

  return (
    <div className="mb-5 mt-5 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
      <div>
        <h3 className="mb-1 font-semibold">Draft Posts</h3>
        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          You have{" "}
          <span className="text-blue-600 dark:text-blue-400">
            {getCount()} draft {getItemType()}
          </span>
        </h4>
      </div>
    </div>
  );
}






