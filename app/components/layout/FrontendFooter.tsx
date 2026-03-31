import { Link } from "@remix-run/react";

import { Logo } from "~/components/ui/Logo";

// Public Nostr profile URL (not a secret; long nprofile path triggers entropy heuristic)
// eslint-disable-next-line no-secrets/no-secrets -- public profile link only
const PRIMAL_NOSTR_PROFILE_URL =
  "https://primal.net/p/nprofile1qqsvtq05wq8m4kggcdhzrsl6w8d57c8m48nslqnmcz4yt77p5td3ppcja7k2u";

export default function Footer() {
  return (
    <footer id="page-footer" className="border-border bg-card border-t">
      <div className="container mx-auto px-4 py-10 text-center sm:py-12 lg:px-8 lg:py-14 xl:max-w-7xl xl:py-16">
        <div className="mb-7 flex justify-center sm:mb-9">
          <Logo
            lightSrc="/logos/Logo-Full-LightMode.svg"
            darkSrc="/logos/Logo-Full-DarkMode.svg"
            alt="SmartFlow Social"
            className="h-10 w-auto sm:h-12"
          />
        </div>
        <nav className="mb-7 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm sm:mb-9 sm:gap-x-8">
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Home
          </Link>
          <Link
            to="/plans"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Plans
          </Link>
          <a
            href={PRIMAL_NOSTR_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Nostr
          </a>
        </nav>
        <div className="text-muted-foreground text-sm">
          <span className="font-medium">SmartFlow Social</span> ©{" "}
          {new Date().getFullYear()}
        </div>
      </div>
    </footer>
  );
}
