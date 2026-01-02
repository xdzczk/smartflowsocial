import { cssBundleHref } from "@remix-run/css-bundle";
import { json } from "@remix-run/node";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
  useLoaderData,
} from "@remix-run/react";
import { Toaster } from "react-hot-toast";

import { getUser } from "~/features/auth/session.server";
import { handleLoaderError } from "~/lib/error-handler.server";
import { normalizeError } from "~/lib/errors";
import stylesheet from "~/tailwind.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    return json({
      user: await getUser(request),
      // Expose Sentry DSN to client (safe - it's a public key)
      ENV: {
        SENTRY_DSN: process.env.SENTRY_DSN ?? null,
        NODE_ENV: process.env.NODE_ENV ?? "development",
      },
    });
  } catch (error) {
    // Handle root loader errors gracefully
    return handleLoaderError(error, {
      user: null,
      ENV: {
        SENTRY_DSN: null,
        NODE_ENV: "development",
      },
    });
  }
};

export const meta = () => [
  { title: "SmartFlow Social - Nostr Post Scheduler" },
  {
    name: "description",
    content:
      "Schedule and automate your Nostr posts with SmartFlow Social. The easiest way to plan and manage your Nostr content calendar.",
  },
  {
    name: "keywords",
    content:
      "nostr, post scheduler, content calendar, automation, social media scheduling, nostr automation, bitcoin",
  },
  { name: "author", content: "SmartFlow Social" },
  { property: "og:title", content: "SmartFlow Social - Nostr Post Scheduler" },
  {
    property: "og:description",
    content:
      "Schedule and automate your Nostr posts with SmartFlow Social. The easiest way to plan and manage your Nostr content calendar.",
  },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: "SmartFlow Social - Nostr Post Scheduler" },
  {
    name: "twitter:description",
    content:
      "Schedule and automate your Nostr posts with SmartFlow Social. The easiest way to plan and manage your Nostr content calendar.",
  },
  { name: "robots", content: "index, follow" },
  { name: "viewport", content: "width=device-width, initial-scale=1" },
];

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function App() {
  const loaderData = useLoaderData<LoaderData>();
  const ENV =
    loaderData &&
    typeof loaderData === "object" &&
    "ENV" in loaderData &&
    loaderData.ENV &&
    typeof loaderData.ENV === "object"
      ? (loaderData.ENV as { SENTRY_DSN: string | null; NODE_ENV: string })
      : { SENTRY_DSN: null, NODE_ENV: "development" };

  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full">
        <Toaster position="top-right" />
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(ENV)}`,
          }}
        />
        <LiveReload />
      </body>
    </html>
  );
}

/**
 * Root Error Boundary
 * Catches errors thrown in loaders, actions, and components
 */
export function ErrorBoundary() {
  const error = useRouteError();

  // Determine error details
  let statusCode = 500;
  let errorMessage = "An unexpected error occurred";
  let errorTitle = "Oops!";
  const isDevelopment = process.env.NODE_ENV === "development";

  if (isRouteErrorResponse(error)) {
    statusCode = error.status;
    errorMessage = error.statusText || errorMessage;
    errorTitle = `${error.status} Error`;
  } else if (error instanceof Error) {
    const normalizedError = normalizeError(error);
    statusCode = normalizedError.statusCode;
    errorMessage = normalizedError.message;
    errorTitle = "Application Error";
  }

  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>{errorTitle}</title>
        <Meta />
        <Links />
      </head>
      <body className="h-full">
        <div className="flex min-h-full flex-col bg-white dark:bg-gray-900">
          <main className="mx-auto flex w-full max-w-7xl flex-auto flex-col justify-center px-4 py-24 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-6xl font-semibold text-gray-900 dark:text-white">
                {statusCode}
              </h1>
              <h2 className="mt-4 text-2xl font-semibold text-gray-900 dark:text-white">
                {errorTitle}
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                {errorMessage}
              </p>
              <div className="mt-10 flex justify-center">
                <a
                  href="/"
                  className="rounded-md bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  Go back home
                </a>
              </div>
              {isDevelopment && error instanceof Error ? (
                <details className="mt-10 text-left">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Error Details (Development Only)
                  </summary>
                  <pre className="mt-4 overflow-auto rounded-lg bg-gray-100 p-4 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                    {error.stack ?? error.toString()}
                  </pre>
                </details>
              ) : null}
            </div>
          </main>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
