import { cssBundleHref } from "@remix-run/css-bundle";
import { json } from "@remix-run/node";
import type {
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
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
import { TooltipProvider } from "~/components/ui/tooltip";
import { getUser, refreshUserProfileIfChanged } from "~/features/auth";
import { RemoteSignerReconnectController } from "~/features/auth/components/RemoteSignerReconnectController";
import { GlobalSigningResumeController } from "~/features/auth/signing/components/GlobalSigningResumeController";
import { GlobalSignRecoveryBanner } from "~/features/auth/signing/components/GlobalSignRecoveryBanner";
import { BtcpayConfirmationWatchBar } from "~/features/payments/components/BtcpayConfirmationWatchBar";
// Import migration to run on app load
import "~/features/auth/signer/remote-signer-sessions-migration.client";
import { BRAND_NAME } from "~/lib/brand";
import { handleLoaderError } from "~/lib/error-handler.server";
import { normalizeError } from "~/lib/errors";
import { QueryProvider } from "~/lib/query/QueryProvider";
import { buildRootDefaultMeta, pageTitle } from "~/lib/seo";
import { getSiteOrigin } from "~/lib/site-url.server";
import stylesheet from "~/tailwind.css";

/** Serialized for inline script: valid theme string or `null` when logged out. */
function accountThemeScriptLiteral(user: unknown): string {
  if (!user || typeof user !== "object") return "null";
  const t = (user as { themePreference?: unknown }).themePreference;
  if (t === "system" || t === "light" || t === "dark") return JSON.stringify(t);
  return JSON.stringify("system");
}

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

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const siteOrigin = getSiteOrigin(request);
  try {
    const { env } = await import("~/lib/env.server");
    // Always get fresh user data - getUser returns null for invalid/expired sessions
    let user = await getUser(request);
    // Refresh Nostr profile (pfp, name) from Primal if changed (user-controlled & can update any time)
    if (user) {
      user = await refreshUserProfileIfChanged(user);
    }

    return json(
      {
        user,
        siteOrigin,
        // Values exposed to the browser bundle via `window.ENV`. Anything
        // here MUST be safe to ship to clients (no secrets). Add new flags
        // alongside SENTRY_DSN / NODE_ENV; `feature-flags.client.ts` reads
        // them at runtime instead of `process.env` (which is undefined in
        // the browser and crashes hydration).
        ENV: {
          SENTRY_DSN: env.SENTRY_DSN ?? null,
          NODE_ENV: env.NODE_ENV ?? "development",
          SIGNING_MULTI_SLOT: env.SIGNING_MULTI_SLOT ?? null,
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
      siteOrigin,
      ENV: {
        SENTRY_DSN: null,
        NODE_ENV: "development",
        SIGNING_MULTI_SLOT: null,
      },
      nonce: undefined,
    });
  }
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const siteOrigin =
    data &&
    typeof data === "object" &&
    "siteOrigin" in data &&
    typeof (data as { siteOrigin: unknown }).siteOrigin === "string"
      ? (data as { siteOrigin: string }).siteOrigin
      : "http://localhost";
  return [
    ...buildRootDefaultMeta(siteOrigin),
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "mobile-web-app-capable", content: "yes" },
    { name: "apple-mobile-web-app-status-bar-style", content: "default" },
    { name: "apple-mobile-web-app-title", content: BRAND_NAME },
    { name: "theme-color", content: "#4408FF" },
  ];
};

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function App() {
  const loaderData = useLoaderData<LoaderData>();
  const ENV =
    typeof loaderData === "object" &&
    "ENV" in loaderData &&
    loaderData.ENV &&
    typeof loaderData.ENV === "object"
      ? (loaderData.ENV as {
          SENTRY_DSN: string | null;
          NODE_ENV: string;
          SIGNING_MULTI_SLOT: string | null;
        })
      : {
          SENTRY_DSN: null,
          NODE_ENV: "development",
          SIGNING_MULTI_SLOT: null,
        };

  const nonce =
    typeof loaderData === "object" &&
    "nonce" in loaderData &&
    typeof loaderData.nonce === "string"
      ? loaderData.nonce
      : undefined;

  const userForTheme =
    typeof loaderData === "object" && "user" in loaderData
      ? (loaderData as { user: unknown }).user
      : null;

  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        {/* Early viewport for mobile Safari / installed PWA (keep in sync with meta export below). */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__SFS_ACCOUNT_THEME__=${accountThemeScriptLiteral(userForTheme)};`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function parseStoredTheme(raw) {
                  if (!raw) return null;
                  var v = raw;
                  try { v = JSON.parse(raw); } catch (e) { /* ignore */ }
                  return (v === 'system' || v === 'light' || v === 'dark') ? v : null;
                }

                function systemEffectiveTheme() {
                  var mql = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
                  return (mql && mql.matches) ? 'dark' : 'light';
                }

                function applyEffectiveTheme(effective) {
                  if (effective === 'dark') document.documentElement.classList.add('dark');
                  else document.documentElement.classList.remove('dark');
                }

                var accountPref = window.__SFS_ACCOUNT_THEME__;
                var stored = localStorage.getItem('theme');
                var sessionRaw = localStorage.getItem('theme_session');
                var sessionOverride = parseStoredTheme(sessionRaw);
                var pref;

                if (accountPref === 'system' || accountPref === 'light' || accountPref === 'dark') {
                  pref = sessionOverride || accountPref;
                } else {
                  pref = parseStoredTheme(stored);
                  if (!pref) pref = 'system';
                }

                var effective = (pref === 'system') ? systemEffectiveTheme() : pref;
                applyEffectiveTheme(effective);

                // Live updates when following system preference.
                if (pref === 'system' && window.matchMedia) {
                  var mql = window.matchMedia('(prefers-color-scheme: dark)');
                  if (mql) {
                    var handler = function() { applyEffectiveTheme(systemEffectiveTheme()); };
                    if (mql.addEventListener) mql.addEventListener('change', handler);
                    else if (mql.addListener) mql.addListener(handler);
                  }
                }
              })();
            `,
          }}
        />
      </head>
      <body className="h-full">
        <QueryProvider>
          <TooltipProvider>
            <Toaster position="top-right" />
            <BtcpayConfirmationWatchBar />
            <LifecycleHandler />
            <PrefetchManager />
            <RemoteSignerReconnectController />
            <GlobalSigningResumeController />
            <GlobalSignRecoveryBanner />
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
          </TooltipProvider>
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
  let errorTitle = pageTitle("Error");
  const isDevelopment = process.env.NODE_ENV === "development";

  if (isRouteErrorResponse(error)) {
    statusCode = error.status;
    errorMessage = error.statusText || errorMessage;
    errorTitle =
      error.status === 404 ? pageTitle("Not Found") : pageTitle("Error");
  } else if (error instanceof Error) {
    const normalizedError = normalizeError(error);
    statusCode = normalizedError.statusCode;
    errorMessage = normalizedError.message;
    errorTitle = pageTitle("Error");
  } else if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    errorMessage = (error as { message: string }).message;
    const errObj = error as unknown as { statusCode?: number };
    statusCode =
      typeof errObj.statusCode === "number" ? errObj.statusCode : 500;
    errorTitle = pageTitle("Error");
  } else if (error != null && typeof error === "object") {
    errorMessage = "An unexpected error occurred";
    errorTitle = pageTitle("Error");
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
        <div className="bg-background flex min-h-full flex-col">
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
                  className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring rounded-md px-6 py-3 text-base font-semibold shadow-sm focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none"
                >
                  Go back home
                </a>
              </div>
              {isDevelopment && error != null ? (
                <details className="mt-10 text-left">
                  <summary className="text-foreground cursor-pointer text-sm font-semibold">
                    Error Details (Development Only)
                  </summary>
                  <pre className="bg-card text-foreground mt-4 overflow-auto rounded-lg p-4 text-xs">
                    {error instanceof Error
                      ? (error.stack ?? error.toString())
                      : JSON.stringify(error, null, 2)}
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
