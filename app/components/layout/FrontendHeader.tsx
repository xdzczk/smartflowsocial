import { Link } from "@remix-run/react";

import { Logo } from "~/components/ui/Logo";
import { ThemeToggle } from "~/components/ui/ThemeToggle";
import NostrAuthButton from "~/features/auth/components/NostrAuthButton";

export default function Header() {
  return (
    <header
      id="page-header"
      className="relative flex flex-none items-center py-8"
    >
      <div className="container mx-auto flex flex-col gap-4 px-4 text-center md:flex-row md:items-center md:justify-between md:gap-0 lg:px-8 xl:max-w-7xl">
        <div>
          <Link
            to="/"
            className="flex h-20 items-center justify-center transition"
          >
            <div className="inline-flex items-center gap-3">
              <Logo
                lightSrc="/logos/Logo-Full-LightMode.svg"
                darkSrc="/logos/Logo-Full-DarkMode.svg"
                alt="SmartFlow Social"
                className="h-10 w-auto"
              />
              <span className="text-foreground text-2xl font-semibold">
                SmartFlow Social
              </span>
            </div>
          </Link>
        </div>
        <div className="flex flex-col gap-4 text-center md:flex-row md:items-center md:justify-between md:gap-0">
          <div className="flex items-center justify-center gap-2">
            <ThemeToggle />
            <NostrAuthButton />
          </div>
        </div>
      </div>
    </header>
  );
}
