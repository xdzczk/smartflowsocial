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

import { LifecycleHandler } from "~/components/lifecycle/LifecycleHandler";
import { PrefetchManager } from "~/components/prefetch/PrefetchManager";
import { getUser, refreshUserProfileIfEmpty } from "~/features/auth";
import { RemoteSignerReconnectController } from "~/features/auth/components/RemoteSignerReconnectController";
// Import migration to run on app load
import "~/lib/remote-signer-sessions-migration.client";
import { handleLoaderError } from "~/lib/error-handler.server";
import { normalizeError } from "~/lib/errors";
import { QueryProvider } from "~/lib/query/QueryProvider";
import stylesheet from "~/tailwind.css";

export const links: LinksFunction = () => {
  return [
    // KanitCyrillic font from Google Fonts
    {
      rel: "preconnect",
      href: "https://fonts.googleapis.com",
    },
    {
      rel: "preconnect",
      href: "https://fonts.gstatic.com",
      crossOrigin: "anonymous",
    },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700;800;900&display=swap",
    },
    { rel: "stylesheet", href: stylesheet },
    ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
    // PWA manifest
    { rel: "manifest", href: "/manifest.json" },
    // Apple touch icons for iOS
    {
      rel: "apple-touch-icon",
      href: "/apple-touch-icon.png",
      sizes: "180x180",
    },
    // Standard icons
    { rel: "icon", href: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { rel: "icon", href: "/icon-512.png", sizes: "512x512", type: "image/png" },
  ];
};

const APP_NAME = "SmartFlow Social";
const APP_TITLE = `${APP_NAME} - Nostr Post Scheduler`;
const APP_DESCRIPTION =
  "Schedule and automate your Nostr posts with SmartFlow Social. The easiest way to plan and manage your Nostr content calendar.";

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  try {
    // Always get fresh user data - getUser returns null for invalid/expired sessions
    let user = await getUser(request);
    // Refresh Nostr profile (pfp, name) from Primal if missing (e.g. logged in before fix or fetch failed)
    if (user) {
      user = await refreshUserProfileIfEmpty(user);
    }

    return json(
      {
        user,
        // Expose Sentry DSN to client (safe - it's a public key)
        ENV: {
          SENTRY_DSN: process.env["SENTRY_DSN"] ?? null,
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: process.env.NODE_ENV may be undefined in some environments
          NODE_ENV: process.env["NODE_ENV"] ?? "development",
        },
        // Pass CSP nonce to client for inline scripts
        nonce:
          typeof context === "object" && "nonce" in context
            ? (context["nonce"] as string)
            : undefined,
      },
      {
        // Prevent caching of authentication state
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    // If error is a Response (e.g., redirect from logout), return it directly
    if (error instanceof Response) {
      return error;
    }
    // Handle root loader errors gracefully - always return null user on error
    return handleLoaderError(error, {
      user: null,
      ENV: {
        SENTRY_DSN: null,
        NODE_ENV: "development",
      },
      nonce: undefined,
    });
  }
};

export const meta = () => [
  { title: APP_TITLE },
  { name: "description", content: APP_DESCRIPTION },
  {
    name: "keywords",
    content:
      "nostr, post scheduler, content calendar, automation, social media scheduling, nostr automation, bitcoin",
  },
  { name: "author", content: APP_NAME },
  { property: "og:title", content: APP_TITLE },
  { property: "og:description", content: APP_DESCRIPTION },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: APP_TITLE },
  { name: "twitter:description", content: APP_DESCRIPTION },
  { name: "robots", content: "index, follow" },
  { name: "viewport", content: "width=device-width, initial-scale=1" },
  // iOS PWA meta tags
  { name: "mobile-web-app-capable", content: "yes" },
  { name: "apple-mobile-web-app-status-bar-style", content: "default" },
  { name: "apple-mobile-web-app-title", content: APP_NAME },
  { name: "theme-color", content: "#4408FF" },
];

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function App() {
  const loaderData = useLoaderData<LoaderData>();
  const ENV =
    typeof loaderData === "object" &&
    "ENV" in loaderData &&
    loaderData.ENV &&
    typeof loaderData.ENV === "object"
      ? (loaderData.ENV as { SENTRY_DSN: string | null; NODE_ENV: string })
      : { SENTRY_DSN: null, NODE_ENV: "development" };

  const nonce =
    typeof loaderData === "object" &&
    "nonce" in loaderData &&
    typeof loaderData.nonce === "string"
      ? loaderData.nonce
      : undefined;

  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const stored = localStorage.getItem('theme');
                let theme;
                if (stored) {
                  // Handle both JSON stringified values and plain strings
                  try {
                    theme = JSON.parse(stored);
                  } catch (e) {
                    // If parsing fails, use the stored value directly (backward compatibility)
                    theme = stored;
                  }
                } else {
                  // Default to dark mode, but respect system preference if available
                  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
                  if (prefersLight) {
                    theme = 'light';
                  } else {
                    // Default to dark if no preference or prefers dark
                    theme = 'dark';
                  }
                }
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="h-full">
        <QueryProvider>
          <Toaster position="top-right" />
          <LifecycleHandler />
          <PrefetchManager />
          <RemoteSignerReconnectController />
          <Outlet />
          <ScrollRestoration />
          <Scripts />
          {nonce ? (
            <script
              nonce={nonce}
              suppressHydrationWarning
              dangerouslySetInnerHTML={{
                __html: `window.ENV = ${JSON.stringify(ENV)}`,
              }}
            />
          ) : null}
          <LiveReload />
        </QueryProvider>
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
        <div className="dark:bg-background flex min-h-full flex-col bg-white">
          <main className="mx-auto flex w-full max-w-7xl flex-auto flex-col justify-center px-4 py-24 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="dark:text-foreground text-foreground text-6xl font-semibold">
                {statusCode}
              </h1>
              <h2 className="dark:text-foreground text-foreground mt-4 text-2xl font-semibold">
                {errorTitle}
              </h2>
              <p className="dark:text-muted-foreground text-foreground mt-4 text-lg">
                {errorMessage}
              </p>
              <div className="mt-10 flex justify-center">
                <a
                  href="/"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary rounded-md px-6 py-3 text-base font-semibold shadow-sm focus-visible:ring-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  Go back home
                </a>
              </div>
              {isDevelopment && error instanceof Error ? (
                <details className="mt-10 text-left">
                  <summary className="text-foreground cursor-pointer text-sm font-semibold">
                    Error Details (Development Only)
                  </summary>
                  <pre className="bg-card text-foreground mt-4 overflow-auto rounded-lg p-4 text-xs">
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
