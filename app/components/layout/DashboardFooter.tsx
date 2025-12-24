import { useState, useEffect } from "react";

import { useUser } from "~/lib/remix-utils";
export default function Footer() {
  const user = useUser();
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
        className="flex flex-none items-center bg-white dark:bg-gray-800/50"
      >
        <div className="max-w-10xl mx-auto flex w-full flex-col px-4 text-center text-sm md:flex-row md:justify-between md:text-left lg:px-8">
          <div className="pb-1 pt-4 md:pb-4">SmartFlow Social © </div>
          <div className="inline-flex items-center justify-center pb-4 pt-1 md:pt-4">
            <span className="font-mono">
              {" "}
              {time.toLocaleDateString("en-US", {
                timeZone: user?.timezone,
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {" ⏰ "}
              {time.toLocaleTimeString("en-US", {
                timeZone: user?.timezone,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
              })}
              {" 🌍 "}
              {user?.timezone}
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
