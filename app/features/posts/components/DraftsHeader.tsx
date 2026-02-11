/**
 * Drafts header component showing title and count
 */

interface DraftsHeaderProps {
  currentTab: string;
  allContentCount: number;
  postsCount: number;
  longformCount: number;
  bulkCount?: number;
}

export function DraftsHeader({
  currentTab,
  allContentCount,
  postsCount,
  longformCount,
  bulkCount = 0,
}: DraftsHeaderProps) {
  const getCount = () => {
    if (currentTab === "all") return allContentCount;
    if (currentTab === "posts") return postsCount;
    if (currentTab === "bulk") return bulkCount;
    return longformCount;
  };

  const getItemType = () => {
    if (currentTab === "all") return "items";
    if (currentTab === "posts") return "posts";
    if (currentTab === "bulk") return "bulk draft groups";
    return "longform articles";
  };

  return (
    <div className="mt-5 mb-5 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
      <div>
        <h3 className="mb-1 font-semibold">Draft Posts</h3>
        <h4 className="text-muted-foreground dark:text-foreground text-sm font-medium">
          You have{" "}
          <span className="text-muted-foreground">
            {getCount()} draft {getItemType()}
          </span>
        </h4>
      </div>
    </div>
  );
}
