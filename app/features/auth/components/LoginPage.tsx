import { useEffect, useState } from "react";

import Footer from "~/components/layout/FrontendFooter";
import Header from "~/components/layout/FrontendHeader";

import { LoginAuthCard } from "./LoginAuthCard";
import { LoginAuthShellProvider } from "./LoginAuthShellContext";
import { LoginWelcomeHeader } from "./LoginWelcomeHeader";
import NostrLoginPanel from "./NostrLoginPanel";

export default function LoginPage() {
  // NostrLoginPanel uses useLoginPanelState from a .client module; only render it on the client to avoid SSR 500
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only gate for .client hook
    setMounted(true);
  }, []);

  return (
    <div
      id="page-container"
      className="bg-background landing-texture relative mx-auto flex min-h-dvh w-full min-w-[320px] flex-col"
    >
      {/* Decorative layer only — must not capture clicks above header/main/footer */}
      <div
        className="hero-gradient-light dark:hero-gradient-dark pointer-events-none absolute inset-0 z-0"
        aria-hidden
      />
      <div className="relative z-10 flex flex-none flex-col">
        <Header />
      </div>
      <main
        id="page-content"
        className="relative z-10 mt-16 flex max-w-full flex-auto flex-col px-4 sm:px-6 lg:px-8"
      >
        <div className="mx-auto w-full max-w-md py-8 sm:max-w-xl lg:max-w-5xl lg:py-16">
          <LoginAuthShellProvider>
            <LoginAuthCard>
              <LoginWelcomeHeader />

              <div className="space-y-6">
                {mounted ? (
                  <NostrLoginPanel />
                ) : (
                  <div
                    className="text-muted-foreground animate-pulse text-sm"
                    aria-live="polite"
                  >
                    Preparing sign-in…
                  </div>
                )}
              </div>
            </LoginAuthCard>
          </LoginAuthShellProvider>
        </div>
      </main>
      <div className="relative z-10 mt-auto shrink-0">
        <Footer marketingHome />
      </div>
    </div>
  );
}
