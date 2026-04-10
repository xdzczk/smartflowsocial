import { Link } from "@remix-run/react";
import { CheckCircle2, Circle } from "lucide-react";

import { Card, CardContent, CardHeader } from "~/components/ui/card";

interface FirstRunDashboardProps {
  activity: {
    hasDrafts: boolean;
    hasScheduled: boolean;
    hasPublished: boolean;
    hasQueuesWithContent: boolean;
  };
  hasAnyQueue: boolean;
}

interface ChecklistItem {
  title: string;
  description: string;
  to: string;
  done: boolean;
}

export function FirstRunDashboard({
  activity,
  hasAnyQueue,
}: FirstRunDashboardProps) {
  const checklistItems: ChecklistItem[] = [
    {
      title: "Create first draft",
      description: "Start with a draft, then refine before scheduling.",
      to: "/dashboard/compose?type=post",
      done: activity.hasDrafts,
    },
    {
      title: "Schedule a post",
      description: "Plan one post ahead to activate your publishing flow.",
      to: "/dashboard/compose?type=post",
      done: activity.hasScheduled || activity.hasPublished,
    },
    {
      title: "Build your first queue",
      description: "Create a reusable queue for consistent publishing.",
      to: "/dashboard/settings?tab=publishing",
      done: hasAnyQueue || activity.hasQueuesWithContent,
    },
  ];

  return (
    <div className="max-w-10xl mx-auto w-full px-4 lg:px-8">
      <div className="space-y-4">
        <Card className="shadow-sm dark:shadow-none">
          <CardContent className="px-5 py-5 md:px-6 md:py-6">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Get started
            </p>
            <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              Start publishing on Nostr properly
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
              Schedule posts, organize queues, and manage your publishing
              workflow from one place.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Link
                to="/dashboard/compose?type=post"
                className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring inline-flex h-10 items-center rounded-md px-4 text-sm font-medium focus:ring-2 focus:outline-none"
              >
                Create first post
              </Link>
              <Link
                to="/dashboard/settings?tab=publishing"
                className="border-border-subtle text-foreground hover:bg-muted/60 focus:ring-ring inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium focus:ring-2 focus:outline-none"
              >
                Create first queue
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm dark:shadow-none">
          <CardHeader className="px-5 pt-4 pb-2 md:px-6">
            <h2 className="text-foreground text-sm font-semibold tracking-tight">
              Quick start
            </h2>
          </CardHeader>
          <CardContent className="space-y-2 px-5 pb-5 md:px-6 md:pb-6">
            {checklistItems.map((item) => (
              <Link
                key={item.title}
                to={item.to}
                className="border-border-subtle hover:bg-muted/50 focus:ring-ring flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors focus:ring-2 focus:outline-none"
              >
                <span className="mt-0.5 shrink-0" aria-hidden>
                  {item.done ? (
                    <CheckCircle2 className="text-primary h-4 w-4" />
                  ) : (
                    <Circle className="text-muted-foreground h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="text-foreground block text-sm font-medium">
                    {item.title}
                  </span>
                  <span className="text-muted-foreground block text-xs leading-5">
                    {item.description}
                  </span>
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card className="shadow-sm dark:shadow-none">
            <CardContent className="p-4">
              <h3 className="text-foreground text-sm font-medium">
                Schedule posts
              </h3>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                Plan posts ahead instead of publishing manually.
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm dark:shadow-none">
            <CardContent className="p-4">
              <h3 className="text-foreground text-sm font-medium">
                Build queues
              </h3>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                Create a consistent publishing flow for memes, threads, promos,
                or campaigns.
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm dark:shadow-none">
            <CardContent className="p-4">
              <h3 className="text-foreground text-sm font-medium">
                Track activity
              </h3>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                Once you start posting, your flow, runway, and queue health
                appear here.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
