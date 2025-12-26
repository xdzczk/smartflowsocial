import { Link, useParams, useRevalidator } from "@remix-run/react";

import { getQueueColor } from "~/features/posts/queueColors";

interface QueueType {
    name: string;
    color?: string;
    isEnabled?: boolean;
}

interface PostedPostsTabsProps {
    currentTab: string;
    queueTypes: (string | QueueType)[];
    allContentLength: number;
    postsLength: number;
    longformPostsLength: number;
}

export default function PostedPostsTabs({
    currentTab,
    queueTypes,
    allContentLength,
    postsLength,
    longformPostsLength,
}: PostedPostsTabsProps) {
    const params = useParams();
    const revalidator = useRevalidator();

    return (
        <>
            {/* Post Type Tabs */}
            <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-8" aria-label="Post Types">
                    <Link
                        to={`/dashboard/posted${params.queueType ? `/${params.queueType}` : ""}?tab=all`}
                        className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${currentTab === "all"
                            ? "border-blue-500 text-blue-600 dark:text-blue-400"
                            : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                            }`}
                    >
                        All ({allContentLength})
                    </Link>
                    <Link
                        to={`/dashboard/posted${params.queueType ? `/${params.queueType}` : ""}?tab=posts`}
                        className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${currentTab === "posts"
                            ? "border-blue-500 text-blue-600 dark:text-blue-400"
                            : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                            }`}
                    >
                        Posts ({postsLength})
                    </Link>
                    <Link
                        to={`/dashboard/posted${params.queueType ? `/${params.queueType}` : ""}?tab=longform`}
                        className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${currentTab === "longform"
                            ? "border-blue-500 text-blue-600 dark:text-blue-400"
                            : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                            }`}
                    >
                        Longform ({longformPostsLength})
                    </Link>
                </nav>
            </div>

            {/* Queue Selection Tabs - Show for all content types */}
            {(currentTab === "all" ||
                currentTab === "posts" ||
                currentTab === "longform") ? (
                <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                    <nav className="-mb-px flex space-x-8" aria-label="Queue Types">
                        <Link
                            to={`/dashboard/posted?tab=${currentTab}`}
                            prefetch="intent"
                            onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
                            className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${!params.queueType
                                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                }`}
                        >
                            All Queues
                        </Link>
                        {queueTypes.map((queueType) => {
                            const queueName =
                                typeof queueType === "string" ? queueType : queueType.name;
                            const queueColor =
                                typeof queueType === "object" ? queueType.color : null;
                            const colors = getQueueColor(queueName, queueColor);
                            const isSelected = params.queueType === queueName;

                            const baseClasses =
                                "whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium capitalize";
                            const unselectedClasses =
                                "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300";

                            if (isSelected && queueColor) {
                                // Use inline styles for custom colors
                                return (
                                    <Link
                                        key={queueName}
                                        to={`/dashboard/posted/${queueName}?tab=${currentTab}`}
                                        prefetch="intent"
                                        onClick={() =>
                                            setTimeout(() => revalidator.revalidate(), 0)
                                        }
                                        className={`${baseClasses} border-b-2`}
                                        style={{
                                            borderBottomColor: queueColor,
                                            color: queueColor,
                                        }}
                                    >
                                        {queueName}
                                    </Link>
                                );
                            }

                            return (
                                <Link
                                    key={queueName}
                                    to={`/dashboard/posted/${queueName}?tab=${currentTab}`}
                                    prefetch="intent"
                                    onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
                                    className={`${baseClasses} ${isSelected
                                        ? `${colors.border.replace("border-", "border-b-")} ${colors.text}`
                                        : unselectedClasses
                                        }`}
                                >
                                    {queueName}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            ) : null}
        </>
    );
}
