import type { ReactNode } from "react";

import Footer from "~/components/layout/FrontendFooter";
import Header from "~/components/layout/FrontendHeader";

export function HomePage(): ReactNode {
  return (
    <>
      <div className="relative overflow-hidden bg-white dark:bg-gray-900 dark:text-gray-100">
        <div className="absolute top-0 right-0 left-0 flex h-64 opacity-70 dark:opacity-50">
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

        <div className="relative container mx-auto px-4 py-16 text-center lg:px-8 lg:py-32 xl:max-w-7xl">
          <div className="mb-2 inline-flex rounded border border-amber-300 bg-amber-200 px-2 py-1 text-sm leading-4 font-medium text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/50 dark:text-amber-200">
            Schedule your nostr content with ease!
          </div>
          <div className="mx-auto my-10 flex size-24 -rotate-6 items-center justify-center rounded-full border border-blue-800 bg-blue-600 text-white ring-4 ring-blue-300 dark:border-blue-500 dark:ring-blue-900">
            <svg
              className="hi-solid hi-bolt inline-block size-10"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <h1 className="mb-4 text-4xl font-black text-black dark:text-white">
            Schedule and Publish Great Nostr Content
          </h1>
          <h2 className="mx-auto text-xl leading-relaxed font-medium text-gray-700 lg:w-2/3 dark:text-gray-300">
            Write, schedule, and publish engaging nostr threads and posts. Take
            control of your nostr presence with our powerful scheduling tools.
          </h2>
          <div className="flex flex-col gap-2 py-10 sm:flex-row sm:items-center sm:justify-center">
            <a
              href="/plans"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-700 bg-blue-700 px-7 py-3.5 leading-6 font-semibold text-white hover:border-blue-600 hover:bg-blue-600 hover:text-white focus:ring focus:ring-blue-400/50 active:border-blue-700 active:bg-blue-700 dark:focus:ring-blue-400/90"
            >
              <span>View Plans</span>
              <svg
                className="hi-mini hi-arrow-right inline-block size-5 opacity-50"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                  clipRule="evenodd"
                />
              </svg>
            </a>
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-7 py-3.5 leading-6 font-semibold text-gray-800 hover:border-gray-300 hover:text-gray-900 hover:shadow-sm focus:ring focus:ring-gray-300/25 active:border-gray-200 active:shadow-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-gray-200 dark:focus:ring-gray-600/40 dark:active:border-gray-700"
            >
              <span>Watch Demo</span>
            </a>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}

export default HomePage;
