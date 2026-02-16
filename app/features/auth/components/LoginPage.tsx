import Footer from "~/components/layout/FrontendFooter";
import Header from "~/components/layout/FrontendHeader";
import { Card, CardContent } from "~/components/ui/card";

import NostrLoginPanel from "./NostrLoginPanel";

export default function LoginPage() {
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
          <Card className="border-border flex flex-col overflow-hidden shadow-xl md:flex-row dark:shadow-2xl">
            <CardContent className="p-6 md:w-1/2 md:p-10 lg:p-16">
              <header className="mb-8 text-center md:text-left">
                <h1 className="text-foreground mb-2 text-3xl font-black tracking-tight sm:text-4xl">
                  Welcome
                </h1>
                <h2 className="text-muted-foreground text-base font-medium sm:text-lg">
                  Sign in to your dashboard using Nostr
                </h2>
              </header>

              <div className="space-y-6">
                <NostrLoginPanel />
              </div>
            </CardContent>

            <div className="hero-motif-bg relative flex min-h-[200px] items-center justify-center px-6 py-10 md:min-h-full md:w-1/2 md:px-10 lg:p-16">
              <div className="relative z-10 text-center sm:text-left">
                <p className="text-foreground mb-2 text-lg leading-relaxed font-bold sm:text-xl">
                  Sign in securely using your{" "}
                  <span className="text-primary">Nostr identity</span>
                </p>
                <p className="text-muted-foreground text-sm font-medium sm:text-base">
                  Powered by Nostr protocol
                </p>
              </div>
            </div>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
