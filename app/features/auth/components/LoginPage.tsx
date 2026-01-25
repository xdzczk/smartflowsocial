import Footer from "~/components/layout/FrontendFooter";
import Header from "~/components/layout/FrontendHeader";
import { Card, CardContent } from "~/components/ui/card";

import NostrLoginPanel from "./NostrLoginPanel";

export default function LoginPage() {
  return (
    <div
      id="page-container"
      className="bg-background relative mx-auto flex min-h-dvh w-full min-w-[320px] flex-col"
    >
      {/* Subtle brand color gradient background */}
      <div className="from-secondary/20 to-background dark:from-background/50 absolute inset-0 bg-gradient-to-b via-transparent" />
      <Header />
      <main
        id="page-content"
        className="relative mt-16 flex max-w-full flex-auto flex-col px-4 sm:px-6 lg:px-8"
      >
        <div className="mx-auto w-full max-w-md py-8 sm:max-w-xl lg:max-w-5xl lg:py-16">
          <Card className="border-border flex flex-col overflow-hidden md:flex-row">
            <CardContent className="p-6 md:w-1/2 md:p-10 lg:p-16">
              <header className="mb-8 text-center md:text-left">
                <h1 className="text-foreground mb-2 text-2xl font-bold sm:text-3xl">
                  Welcome
                </h1>
                <h2 className="text-muted-foreground text-sm font-medium">
                  Sign in to your dashboard using Nostr
                </h2>
              </header>

              <div className="space-y-6">
                <NostrLoginPanel />
              </div>
            </CardContent>

            <div
              className="relative flex min-h-[200px] items-center bg-cover px-6 py-10 md:min-h-full md:w-1/2 md:px-10 lg:p-16"
              style={{
                backgroundImage: 'url("/photo-m_7p45JfXQo-600x600.jpg")',
              }}
            >
              <div className="bg-primary/80 dark:bg-primary/60 absolute inset-0 rounded-r-lg" />
              <div className="relative text-center sm:text-left">
                <p className="text-primary-foreground mb-2 text-lg leading-relaxed font-semibold sm:text-xl">
                  Sign in securely using your Nostr identity
                </p>
                <p className="text-primary-foreground/90 text-sm font-medium sm:text-base">
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
