import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

import Footer from "~/components/layout/FrontendFooter";
import Header from "~/components/layout/FrontendHeader";
import { Card, CardContent } from "~/components/ui/card";
import { NostrAuthButton, getUserId } from "~/features/auth";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const userId = await getUserId(request);
    if (userId) return redirect("/dashboard");
    return json({});
  } catch (error) {
    // For login page, errors are non-critical - just return empty data
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {});
  }
};

export const meta = () => [{ title: "Login" }];

export default function LoginPage() {
  return (
    <div
      id="page-container"
      className="mx-auto flex min-h-dvh w-full min-w-[320px] flex-col bg-gray-100 dark:bg-gray-900 dark:text-gray-100"
    >
      <div className="absolute left-0 right-0 top-0 flex h-64 opacity-70 dark:opacity-50">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white dark:to-gray-900" />
        <div className="grow bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900" />
        <div className="grow bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900 dark:to-teal-900" />
        <div className="grow bg-gradient-to-r from-teal-100 to-cyan-100 dark:from-teal-900 dark:to-cyan-900" />
        <div className="grow bg-gradient-to-r from-cyan-100 to-sky-100 dark:from-cyan-900 dark:to-sky-900" />
        <div className="grow bg-gradient-to-r from-sky-100 to-blue-100 dark:from-sky-900 dark:to-blue-900" />
        <div className="grow bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900" />
        <div className="grow bg-gradient-to-r from-indigo-100 to-violet-100 dark:from-indigo-900 dark:to-violet-900" />
        <div className="grow bg-gradient-to-r from-violet-100 to-purple-100 dark:from-violet-900 dark:to-purple-900" />
        <div className="grow bg-gradient-to-r from-purple-100 to-fuchsia-100 dark:from-purple-900 dark:to-fuchsia-900" />
        <div className="grow bg-gradient-to-r from-fuchsia-100 to-pink-100 dark:from-fuchsia-900 dark:to-pink-900" />
        <div className="grow bg-gradient-to-r from-pink-100 to-rose-100 dark:from-pink-900 dark:to-rose-900" />
      </div>
      <Header />
      <main
        id="page-content"
        className="mt-16 flex max-w-full flex-auto flex-col px-4 sm:px-6 lg:px-8"
      >
        <div className="mx-auto w-full max-w-md py-8 sm:max-w-xl lg:max-w-5xl lg:py-16">
          <Card className="flex flex-col overflow-hidden md:flex-row">
            <CardContent className="p-6 md:w-1/2 md:p-10 lg:p-16">
              <header className="mb-8 text-center md:text-left">
                <h1 className="mb-2 text-2xl font-bold sm:text-3xl">Welcome</h1>
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Sign in to your dashboard using Nostr
                </h2>
              </header>

              <div className="space-y-6">
                <NostrAuthButton />
              </div>
            </CardContent>

            <div
              className="relative flex min-h-[200px] items-center bg-cover px-6 py-10 md:min-h-full md:w-1/2 md:px-10 lg:p-16"
              style={{
                backgroundImage: 'url("/photo-m_7p45JfXQo-600x600.jpg")',
              }}
            >
              <div className="absolute inset-0 rounded-r-lg bg-blue-900/50" />
              <div className="relative text-center sm:text-left">
                <p className="mb-2 text-lg font-semibold leading-relaxed text-white sm:text-xl">
                  Sign in securely using your Nostr identity
                </p>
                <p className="text-sm font-medium text-white/75 sm:text-base">
                  Powered by Nostr protocol
                </p>
              </div>
            </div>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
