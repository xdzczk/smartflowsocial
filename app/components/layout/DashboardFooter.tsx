import { useState, useEffect } from "react";

import { useOptionalUser } from "~/lib/remix-utils";
export default function Footer() {
  const user = useOptionalUser() ?? null;
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <footer
        id="page-footer"
        className="border-border bg-card sticky bottom-0 z-10 flex flex-none items-center border-t"
      >
        <div className="max-w-10xl mx-auto flex w-full flex-col px-4 text-center text-sm md:flex-row md:justify-between md:text-left lg:px-8">
          <div className="text-foreground pt-4 pb-1 md:pb-4">
            SmartFlow Social ©{" "}
          </div>
          <div className="inline-flex items-center justify-center pt-1 pb-4 md:pt-4">
            <span className="text-foreground font-mono">
              {" "}
              {time.toLocaleDateString("en-US", {
                timeZone:
                  user && typeof user === "object" && "timezone" in user
                    ? (user.timezone ?? undefined)
                    : undefined,
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {" ⏰ "}
              {time.toLocaleTimeString("en-US", {
                timeZone: user?.timezone ?? undefined,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
              })}
              {" 🌍 "}
              {user && typeof user === "object" && "timezone" in user
                ? user.timezone
                : undefined}
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
