import {
  Outlet,
  useLoaderData,
  Link,
  Form,
  useNavigation,
} from "@remix-run/react";
import { useState } from "react";
import type { ReactNode } from "react";

import Footer from "~/components/layout/DashboardFooter";
import Header from "~/components/layout/DashboardHeader";
import type { loader as dashboardLoader } from "~/routes/dashboard";

const DESKTOP_SIDEBAR_OPEN_KEY = "dashboard-desktop-sidebar-open";

function ProfileBits({ nostrProfile }: { nostrProfile: unknown }): ReactNode {
  let name: string | undefined;
  let display_name: string | undefined;
  try {
    const p =
      typeof nostrProfile === "string"
        ? (JSON.parse(nostrProfile) as { name?: string; display_name?: string })
        : (nostrProfile as
            | { name?: string; display_name?: string }
            | undefined);
    name = p?.name;
    display_name = p?.display_name;
  } catch {
    /* ignore parse errors */
  }
  return <>{name ?? display_name ?? "Unknown User"}</>;
}

export function DashboardLayoutPage(): ReactNode {
  const { currentSubscription, pendingParentUsers } =
    useLoaderData<typeof dashboardLoader>();
  const isFreePlan = currentSubscription?.planId === "free";
  const isSubscriptionExpired =
    currentSubscription && currentSubscription.status !== "ACTIVE";
  const navigation = useNavigation();
  const navAction =
    (navigation.formData?.get("_action") as string) || undefined;
  const navParentNpub =
    (navigation.formData?.get("parentNpub") as string) || undefined;
  const navDecision =
    (navigation.formData?.get("decision") as string) || undefined;

  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(DESKTOP_SIDEBAR_OPEN_KEY) !== "false";
  });
  const handleDesktopSidebarToggle = () => {
    setDesktopSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem(DESKTOP_SIDEBAR_OPEN_KEY, String(next));
      return next;
    });
  };

  return (
    <>
      <div
        id="page-container"
        className={`bg-background mx-auto flex min-h-dvh w-full min-w-[320px] flex-col ${desktopSidebarOpen ? "lg:pl-64" : "lg:pl-16"}`}
      >
        <Header
          desktopSidebarOpen={desktopSidebarOpen}
          onDesktopSidebarToggle={handleDesktopSidebarToggle}
        />

        <main
          id="page-content"
          className="flex max-w-full flex-auto flex-col pt-[3.25rem]"
        >
          {pendingParentUsers.length > 0 ? (
            <div className="max-w-10xl mx-auto w-full px-4 pt-4 lg:px-8">
              {pendingParentUsers.map((p) => {
                const isThisSubmitting =
                  navigation.state === "submitting" &&
                  navAction === "respond_child_request" &&
                  navParentNpub === p.npub;
                return (
                  <div
                    key={p.npub}
                    className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100"
                  >
                    <div>
                      <p className="font-medium">
                        <ProfileBits nostrProfile={p.nostrProfile} /> wants to
                        manage your account
                      </p>
                      <p className="text-sm opacity-90">
                        Approve to link your account as a child, or reject this
                        request.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Form method="post">
                        <input
                          type="hidden"
                          name="_action"
                          value="respond_child_request"
                        />
                        <input type="hidden" name="parentNpub" value={p.npub} />
                        <input type="hidden" name="decision" value="reject" />
                        <button
                          className="bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex items-center rounded-md px-3 py-2 text-sm font-medium disabled:opacity-70"
                          type="submit"
                          disabled={isThisSubmitting}
                        >
                          {isThisSubmitting && navDecision === "reject"
                            ? "Rejecting..."
                            : "Reject"}
                        </button>
                      </Form>
                      <Form method="post">
                        <input
                          type="hidden"
                          name="_action"
                          value="respond_child_request"
                        />
                        <input type="hidden" name="parentNpub" value={p.npub} />
                        <input type="hidden" name="decision" value="accept" />
                        <button
                          className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary inline-flex items-center rounded-md px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:opacity-70"
                          type="submit"
                          disabled={isThisSubmitting}
                        >
                          {isThisSubmitting && navDecision === "accept"
                            ? "Approving..."
                            : "Approve"}
                        </button>
                      </Form>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {isSubscriptionExpired ? (
            <div className="max-w-10xl mx-auto w-full px-4 pt-4 lg:px-8">
              <div className="border-border bg-muted text-muted-foreground mb-4 flex items-start justify-between gap-3 rounded-lg border p-4">
                <div>
                  <p className="font-medium">Your subscription has expired</p>
                  <p className="text-sm opacity-90">
                    You’re on the Free plan now. Resubscribe to restore your
                    previous plan benefits.
                  </p>
                </div>
                <Link
                  prefetch="intent"
                  to="/plans"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary inline-flex items-center rounded-md px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-offset-2 focus:outline-none"
                >
                  View plans
                </Link>
              </div>
            </div>
          ) : isFreePlan ? (
            <div className="max-w-10xl mx-auto w-full px-4 pt-4 lg:px-8">
              <div className="border-border bg-muted text-muted-foreground mb-4 flex items-start justify-between gap-3 rounded-lg border p-4">
                <div>
                  <p className="font-medium">You’re on the Free plan</p>
                  <p className="text-sm opacity-90">
                    Upgrade to unlock calendars, drafts, templates, bulk
                    scheduling, and more.
                  </p>
                </div>
                <Link
                  prefetch="intent"
                  to="/plans"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary inline-flex items-center rounded-md px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-offset-2 focus:outline-none"
                >
                  View plans
                </Link>
              </div>
            </div>
          ) : null}

          <div className="max-w-10xl mx-auto w-full px-4 pt-4.5 pb-24 lg:px-8 lg:pt-4.5 lg:pb-24">
            <Outlet />
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}

export default DashboardLayoutPage;
