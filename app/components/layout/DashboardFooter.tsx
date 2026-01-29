import { ClockIcon } from "@heroicons/react/20/solid";
import { useState, useEffect } from "react";

import { SyncStatusIndicator } from "~/components/sync/SyncStatusIndicator";
import { useOptionalUser } from "~/lib/remix-utils";

// Helper to extract city name from timezone (e.g., "Africa/Cairo" -> "Cairo")
function getTimezoneShortName(timezone: string | undefined): string {
  if (!timezone) return "";
  const parts = timezone.split("/");
  return parts[parts.length - 1] ?? timezone;
}

/** Placeholder for clock while hydrating to avoid server/client date mismatch (React hydration errors #418/#425). */
const CLOCK_PLACEHOLDER = "–";

export default function Footer() {
  const user = useOptionalUser() ?? null;
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setMounted(true);
      setTime(new Date());
    }, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, [mounted]);

  const userTimezone =
    user && typeof user === "object" && "timezone" in user
      ? (user.timezone ?? undefined)
      : undefined;

  const userTimeFormat =
    user && typeof user === "object" && "timeFormat" in user
      ? user.timeFormat === "24h"
        ? "24h"
        : "12h"
      : "12h";

  const dateString =
    mounted && time
      ? time.toLocaleDateString("en-US", {
          timeZone: userTimezone,
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : CLOCK_PLACEHOLDER;

  const timeString =
    mounted && time
      ? time.toLocaleTimeString("en-US", {
          timeZone: userTimezone,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: userTimeFormat === "12h",
        })
      : CLOCK_PLACEHOLDER;

  const timezoneShort = getTimezoneShortName(userTimezone);

  return (
    <footer
      id="page-footer"
      className="border-border bg-card sticky bottom-0 z-10 flex flex-none items-center border-t"
    >
      <div className="max-w-10xl mx-auto flex w-full flex-col gap-2 px-3 py-2 text-center text-xs sm:flex-row sm:justify-between sm:gap-0 sm:px-4 sm:py-2.5 sm:text-left sm:text-sm md:px-6 lg:px-8">
        <div className="text-muted-foreground">
          SmartFlow Social © {new Date().getFullYear()}
        </div>
        <div className="text-muted-foreground flex items-center justify-center gap-1.5 sm:gap-2">
          <SyncStatusIndicator />
          <span className="hidden lg:inline">·</span>
          <ClockIcon className="h-3 w-3 flex-shrink-0 sm:h-3.5 sm:w-3.5" />
          <span className="hidden sm:inline">{dateString}</span>
          <span className="sm:hidden">
            {dateString === CLOCK_PLACEHOLDER
              ? CLOCK_PLACEHOLDER
              : dateString.split(",")[0]}
          </span>
          <span className="hidden lg:inline">·</span>
          <span>{timeString}</span>
          {userTimezone ? (
            <>
              <span className="hidden lg:inline">·</span>
              <span className="hidden sm:inline lg:hidden">
                {timezoneShort}
              </span>
              <span className="hidden lg:inline">{userTimezone}</span>
              <span className="sm:hidden">{timezoneShort}</span>
            </>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
