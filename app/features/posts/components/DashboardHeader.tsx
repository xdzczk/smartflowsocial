/**
 * Dashboard header component showing title and count
 */

interface DashboardHeaderProps {
  currentTab: string;
  allContentCount: number;
  postsCount: number;
  longformCount: number;
}

export function DashboardHeader({
  currentTab,
  allContentCount,
  postsCount,
  longformCount,
}: DashboardHeaderProps) {
  const getTitle = () => {
    if (currentTab === "all") return "All Scheduled Content";
    if (currentTab === "posts") return "Scheduled Posts";
    return "Scheduled Longform";
  };

  const getCount = () => {
    if (currentTab === "all") return allContentCount;
    if (currentTab === "posts") return postsCount;
    return longformCount;
  };

  const getItemType = () => {
    if (currentTab === "all") return "items";
    if (currentTab === "posts") return "posts";
    return "longform posts";
  };

  return (
    <div className="mb-5 mt-5 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
      <div>
        <h3 className="mb-1 font-semibold">{getTitle()}</h3>
        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          You have{" "}
          <span className="text-blue-600 dark:text-blue-400">
            {getCount()} scheduled {getItemType()}
          </span>
        </h4>
      </div>
    </div>
  );
}









