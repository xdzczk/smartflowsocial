import { Link } from "@remix-run/react";

import { Logo } from "~/components/ui/Logo";
import { BRAND_MARKETING_URL, BRAND_NAME } from "~/lib/brand";
import { cn } from "~/lib/utils";

// Public Nostr profile URL (not a secret; long nprofile path triggers entropy heuristic)
const PRIMAL_NOSTR_PROFILE_URL =
  // eslint-disable-next-line no-secrets/no-secrets -- public profile link only
  "https://primal.net/p/nprofile1qqsvtq05wq8m4kggcdhzrsl6w8d57c8m48nslqnmcz4yt77p5td3ppcja7k2u";

export interface FrontendFooterProps {
  /** When true, “Home” opens the marketing site (use on app login where `/` is still login). */
  marketingHome?: boolean;
  className?: string;
}

export default function Footer({
  marketingHome = false,
  className,
}: FrontendFooterProps) {
  return (
    <footer
      id="page-footer"
      className={cn("border-border bg-surface border-t", className)}
    >
      <div className="container mx-auto px-4 py-8 text-center sm:py-9 lg:px-8 lg:py-10 xl:max-w-7xl">
        <div className="mb-5 flex justify-center sm:mb-6">
          <Logo
            lightSrc="/logos/Logo-Full-LightMode.svg"
            darkSrc="/logos/Logo-Full-DarkMode.svg"
            alt={BRAND_NAME}
            className="h-9 w-auto sm:h-10"
          />
        </div>
        <nav className="mb-5 flex flex-wrap justify-center gap-x-5 gap-y-2.5 text-sm sm:mb-6 sm:gap-x-7">
          {marketingHome ? (
            <a
              href={BRAND_MARKETING_URL}
              className="text-text-secondary hover:text-text motion-fast"
              rel="noopener noreferrer"
            >
              Home
            </a>
          ) : (
            <Link
              to="/"
              className="text-text-secondary hover:text-text motion-fast"
            >
              Home
            </Link>
          )}
          <Link
            to="/plans"
            className="text-text-secondary hover:text-text motion-fast"
          >
            Plans
          </Link>
          <a
            href={PRIMAL_NOSTR_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-secondary hover:text-text motion-fast"
          >
            Nostr
          </a>
        </nav>
        <div className="text-text-secondary text-sm">
          <span className="font-medium">{BRAND_NAME}</span> ©{" "}
          {new Date().getFullYear()}
        </div>
      </div>
    </footer>
  );
}
