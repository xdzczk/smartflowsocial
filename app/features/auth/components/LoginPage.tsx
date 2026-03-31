import { useEffect, useState } from "react";

import Footer from "~/components/layout/FrontendFooter";
import Header from "~/components/layout/FrontendHeader";

import { LoginAuthCard } from "./LoginAuthCard.client";
import { LoginAuthShellProvider } from "./LoginAuthShellContext.client";
import { LoginWelcomeHeader } from "./LoginWelcomeHeader.client";
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
      {/* Enhanced background gradient with micro-depth - matching landing page */}
      <div className="hero-gradient-light dark:hero-gradient-dark absolute inset-0" />
      <Header />
      <main
        id="page-content"
        className="relative mt-16 flex max-w-full flex-auto flex-col px-4 sm:px-6 lg:px-8"
      >
        <div className="mx-auto w-full max-w-md py-8 sm:max-w-xl lg:max-w-5xl lg:py-16">
          <LoginAuthShellProvider>
            <LoginAuthCard>
              <LoginWelcomeHeader />

              <div className="space-y-6">
                {mounted ? <NostrLoginPanel /> : null}
              </div>
            </LoginAuthCard>
          </LoginAuthShellProvider>
        </div>
      </main>
      <Footer />
    </div>
  );
}
