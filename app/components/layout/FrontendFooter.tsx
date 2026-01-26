import { Link } from "@remix-run/react";

import { Logo } from "~/components/ui/Logo";

export default function Footer() {
  return (
    <footer id="page-footer" className="border-border bg-card border-t">
      <div className="container mx-auto px-4 py-8 text-center sm:py-12 lg:px-8 lg:py-16 xl:max-w-7xl xl:py-32">
        <div className="mb-6 flex justify-center sm:mb-8">
          <Logo
            lightSrc="/logos/Logo-Full-LightMode.svg"
            darkSrc="/logos/Logo-Full-DarkMode.svg"
            alt="SmartFlow Social"
            className="h-10 w-auto sm:h-12"
          />
        </div>
        <nav className="mb-6 flex flex-wrap justify-center gap-4 text-sm sm:mb-8 sm:gap-6">
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
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Blog
          </Link>
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Contact
          </Link>
        </nav>
        <div className="text-muted-foreground text-sm">
          <span className="font-medium">SmartFlow Social</span> ©{" "}
          {new Date().getFullYear()}
        </div>
      </div>
    </footer>
  );
}
