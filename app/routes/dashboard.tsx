import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { Outlet, useLoaderData, Link, Form, useNavigation } from "@remix-run/react";

import Footer from "~/components/layout/DashboardFooter";
import Header from "~/components/layout/DashboardHeader";
import { requireUser } from "~/features/auth/session.server";
import { requireActiveSubscription } from "~/features/payments/subscriptions.server";
import { loadDashboardData, handleDashboardAction } from "~/features/user";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireUser(request);

  // Root dashboard also requires an ACTIVE subscription
  const subscriptionData = await requireActiveSubscription(user.id);

  // Pending parent link requests for this user (as child)
   
  const pendingParentNpubs: string[] =
    (user as unknown as { pendingParentRequests?: string[] }).pendingParentRequests || [];
  
  const dashboardData = await loadDashboardData(user.id, user.npub, pendingParentNpubs);

  return json({
    userId: user.id,
    user: subscriptionData.user,
    currentSubscription: subscriptionData.currentSubscription,
    ...dashboardData,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await requireUser(request);
  const formData = await request.formData();
  return handleDashboardAction(formData, user.id, user.npub);
};

function ProfileBits({ nostrProfile }: { nostrProfile: unknown }) {
  let name: string | undefined;
  let display_name: string | undefined;
  try {
    const p =
      typeof nostrProfile === "string"
        ? (JSON.parse(nostrProfile) as { name?: string; display_name?: string })
        : (nostrProfile as { name?: string; display_name?: string } | undefined);
    name = p?.name;
    display_name = p?.display_name;
  } catch { /* ignore parse errors */ }
  return <>{name || display_name || "Unknown User"}</>;
}

export default function Dashboard() {
  const { currentSubscription, pendingParentUsers } =
    useLoaderData<typeof loader>();
  const isFreePlan = currentSubscription?.planId === "free";
  const navigation = useNavigation();
  const navAction = (navigation.formData?.get("_action") as string) || undefined;
  const navParentNpub = (navigation.formData?.get("parentNpub") as string) || undefined;
  const navDecision = (navigation.formData?.get("decision") as string) || undefined;

  return (
    <>
      <div
        id="page-container"
        className={`mx-auto flex min-h-dvh w-full min-w-[320px] flex-col bg-gray-100 dark:bg-gray-900 dark:text-gray-100 lg:pl-64`}
      >
        <Header />

        <main
          id="page-content"
          className="flex max-w-full flex-auto flex-col pt-16"
        >
          {pendingParentUsers?.length ? (
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
                          className="inline-flex items-center rounded-md bg-gray-200 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-300 disabled:opacity-70 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                          type="submit"
                          disabled={isThisSubmitting}
                        >
                          {isThisSubmitting && navDecision === "reject" ? "Rejecting..." : "Reject"}
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
                          className="inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                          type="submit"
                          disabled={isThisSubmitting}
                        >
                          {isThisSubmitting && navDecision === "accept" ? "Approving..." : "Approve"}
                        </button>
                      </Form>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {isFreePlan ? <div className="max-w-10xl mx-auto w-full px-4 pt-4 lg:px-8">
            <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-100">
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
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                View plans
              </Link>
            </div>
          </div> : null}

          <div className="max-w-10xl mx-auto w-full p-4 lg:p-8">
            <Outlet />
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
