import { Link } from "@remix-run/react";

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
            <div className="inline-flex items-center gap-2 text-2xl font-semibold">
              <svg
                className="size-8 text-blue-600 dark:text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.477 2 2 6.477 2 12c0 5.523 4.477 10 10 10s10-4.477 10-10c0-5.523-4.477-10-10-10zm0 18c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8zm1-11h-2v3H8v2h3v3h2v-3h3v-2h-3V9z" />
              </svg>
              <span>SmartFlow Social</span>
            </div>
          </Link>
        </div>
        <div className="flex flex-col gap-4 text-center md:flex-row md:items-center md:justify-between md:gap-0">
          <div className="flex items-center justify-center gap-2">
            <NostrAuthButton />
          </div>
        </div>
      </div>
    </header>
  );
}
