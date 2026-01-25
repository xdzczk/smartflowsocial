import { Link } from "@remix-run/react";

export default function Footer() {
  return (
    <footer id="page-footer" className="border-border bg-card border-t">
      <div className="container mx-auto px-4 py-16 text-center lg:px-8 lg:py-32 xl:max-w-7xl">
        <div className="mb-8 flex justify-center">
          {/* Light mode logo - shown in light mode, hidden in dark mode */}
          <img
            src="/logos/Logo-Full-LightMode.svg"
            alt="SmartFlow Social"
            className="block h-12 w-auto dark:hidden"
          />
          {/* Dark mode logo - hidden in light mode, shown in dark mode */}
          <img
            src="/logos/Logo-Full-DarkMode.svg"
            alt="SmartFlow Social"
            className="hidden h-12 w-auto dark:block"
          />
        </div>
        <nav className="mb-8 flex flex-wrap justify-center gap-6 text-sm">
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
