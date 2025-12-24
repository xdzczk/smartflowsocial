import { cssBundleHref } from "@remix-run/css-bundle";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import { Toaster } from "react-hot-toast";

import { getUser } from "~/features/auth/session.server";
import stylesheet from "~/tailwind.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ user: await getUser(request) });
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

export default function App() {
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
        <LiveReload />
      </body>
    </html>
  );
}
