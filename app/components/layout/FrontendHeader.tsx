import { Logo } from "~/components/ui/Logo";
import { ThemeToggle } from "~/components/ui/ThemeToggle";
import NostrAuthButton from "~/features/auth/components/NostrAuthButton";
import { BRAND_NAME } from "~/lib/brand";

export default function Header() {
  return (
    <header
      id="page-header"
      className="pt-safe-top safe-x-4 relative flex flex-none items-center py-4 sm:py-6 lg:py-8"
    >
      <div className="container mx-auto flex flex-row items-center justify-between gap-3 px-4 sm:gap-4 lg:px-8 xl:max-w-7xl">
        <div>
          <a
            href="https://smartflow.social"
            rel="noopener noreferrer"
            className="motion-fast flex h-10 items-center justify-center sm:h-12 lg:h-16"
            aria-label={`${BRAND_NAME} – Home`}
          >
            <Logo
              lightSrc="/logos/Logo-Full-LightMode.svg"
              darkSrc="/logos/Logo-Full-DarkMode.svg"
              alt={BRAND_NAME}
              className="h-7 w-auto sm:h-9 lg:h-10"
            />
          </a>
        </div>
        <div className="cluster">
          <ThemeToggle />
          <NostrAuthButton />
        </div>
      </div>
    </header>
  );
}
