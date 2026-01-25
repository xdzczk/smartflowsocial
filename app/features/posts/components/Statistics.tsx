import { useLoaderData, Link } from "@remix-run/react";

import { Card, CardContent } from "~/components/ui/card";
import type { PostStatistics } from "~/models/post.types";
export default function Statistics() {
  const { postStatistics } = useLoaderData<{
    postStatistics: PostStatistics | undefined;
  }>();

  // Provide fallback if postStatistics is undefined
  const stats = postStatistics ?? { scheduledCount: 0, successCount: 0 };

  return (
    <>
      {/* Statistics: Simple with Icons */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-8">
        {/* Card */}
        <Card>
          <CardContent className="flex grow items-center justify-between p-5">
            <div className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-xl">
              <svg
                className="hi-solid hi-clock inline-block size-8"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <dl className="space-y-1 text-right">
              <dt className="text-foreground text-2xl font-bold">
                {stats.scheduledCount}
              </dt>
              <dd className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
                Scheduled Posts
              </dd>
            </dl>
          </CardContent>
        </Card>
        {/* END Card */}

        {/* Card */}
        <Card>
          <CardContent className="flex grow items-center justify-between p-5">
            <div className="flex size-16 items-center justify-center rounded-xl bg-green-500/20 text-green-600 dark:text-green-400">
              <svg
                className="hi-solid hi-check-circle inline-block size-8"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <dl className="space-y-1 text-right">
              <dt className="text-foreground text-2xl font-bold">
                {stats.successCount}
              </dt>
              <dd className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
                Posted Successfully
              </dd>
            </dl>
          </CardContent>
        </Card>
        {/* END Card */}

        {/* Create New Post Button Card */}
        <Card className="border-primary bg-primary hover:bg-primary/90 transition-all hover:scale-105 hover:shadow-xl">
          <CardContent className="p-0">
            <Link
              to="/dashboard/newpost"
              className="text-primary-foreground hover:text-primary-foreground/90 flex grow items-center justify-between p-5"
            >
              <div className="bg-primary-foreground/20 text-primary-foreground flex size-16 items-center justify-center rounded-xl">
                <svg
                  className="hi-solid hi-plus-circle inline-block size-8"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 9a.75.75 0 00-1.5 0v2.25H9a.75.75 0 000 1.5h2.25V15a.75.75 0 001.5 0v-2.25H15a.75.75 0 000-1.5h-2.25V9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <dl className="space-y-1 text-right">
                <dt className="text-primary-foreground text-2xl font-bold">
                  New
                </dt>
                <dd className="text-primary-foreground/80 text-sm font-semibold tracking-wider uppercase">
                  Create Post
                </dd>
              </dl>
            </Link>
          </CardContent>
        </Card>
        {/* END Create New Post Button Card */}
      </div>
      {/* END Statistics: Simple with Icons */}
    </>
  );
}
