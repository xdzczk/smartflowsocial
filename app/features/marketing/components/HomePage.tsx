import type { ReactNode } from "react";

import Footer from "~/components/layout/FrontendFooter";
import Header from "~/components/layout/FrontendHeader";

export function HomePage(): ReactNode {
  return (
    <>
      <div className="bg-background relative min-h-screen overflow-hidden">
        {/* Background gradient */}
        <div className="from-secondary/20 to-background dark:from-background/20 absolute inset-0 bg-gradient-to-b via-transparent" />

        <Header />

        {/* Hero Section */}
        <section className="relative container mx-auto px-4 py-16 lg:px-8 lg:py-32 xl:max-w-7xl">
          <div className="mx-auto max-w-4xl text-center">
            <div className="border-border bg-muted text-muted-foreground mb-6 inline-flex rounded-full border px-4 py-2 text-sm font-medium">
              Schedule your nostr content with ease!
            </div>

            <h1 className="text-foreground mb-6 text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
              OWN YOUR CADENCE
              <br />
              <span className="text-foreground">ACROSS EVERY RELAY</span>
            </h1>

            <p className="text-muted-foreground mx-auto mb-10 text-xl leading-relaxed lg:w-3/4 lg:text-2xl">
              Sovereign publishing infrastructure. Design the system once.
              Cadence holds indefinitely.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <a
                href="/plans"
                className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary inline-flex items-center justify-center gap-2 rounded-lg px-8 py-4 text-lg font-semibold transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
              >
                <span>ENTER CONSOLE</span>
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
              <a
                href="/"
                className="border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground focus:ring-primary inline-flex items-center justify-center gap-2 rounded-lg border px-8 py-4 text-lg font-semibold transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
              >
                <span>Watch Demo</span>
              </a>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-border bg-card relative border-t py-24">
          <div className="container mx-auto px-4 lg:px-8 xl:max-w-7xl">
            <div className="mb-16 text-center">
              <h2 className="text-foreground mb-4 text-4xl font-black">
                FLOW WITHOUT CHAOS
              </h2>
              <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
                SmartFlowSocial links drafts, queues, automation, and analytics
                into a single, repeating system. Cadence holds without constant
                operator input.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: "EXACTLY-ONCE PUBLISHING",
                  description:
                    "Guaranteed delivery with no duplicates. Your content publishes exactly once, every time.",
                },
                {
                  title: "SOVEREIGN INFRASTRUCTURE",
                  description:
                    "No key custody. No growth hacks. Protocol-first. Designed for serious operators.",
                },
                {
                  title: "CADENCE & FLOW",
                  description:
                    "Design your publishing cadence once. The system maintains it indefinitely.",
                },
                {
                  title: "ANALYTICS & INSIGHTS",
                  description:
                    "Track performance, engagement, and optimize your content strategy.",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="border-border bg-background rounded-lg border p-6 transition-shadow hover:shadow-lg"
                >
                  <div className="bg-muted mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                    <div className="bg-muted-foreground/30 h-6 w-6 rounded" />
                  </div>
                  <h3 className="text-foreground mb-2 text-lg font-bold">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Process Flow Section */}
        <section className="border-border bg-background relative border-t py-24">
          <div className="container mx-auto px-4 lg:px-8 xl:max-w-7xl">
            <div className="mb-16 text-center">
              <h2 className="text-foreground mb-4 text-4xl font-black">
                CADENCE & FLOW
              </h2>
              <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
                FLOW WITHOUT CHAOS
              </p>
            </div>

            <div className="mx-auto max-w-4xl">
              <div className="flex flex-wrap items-center justify-center gap-4">
                {["Draft", "Queue", "Publish"].map((step, idx) => (
                  <div key={step} className="flex items-center gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <div className="bg-muted border-border text-muted-foreground flex h-16 w-16 items-center justify-center rounded-lg border">
                        <div className="bg-muted-foreground/30 h-8 w-8 rounded" />
                      </div>
                      <span className="text-foreground text-sm font-semibold">
                        {step}
                      </span>
                    </div>
                    {idx < 2 ? (
                      <svg
                        className="text-muted-foreground h-6 w-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    ) : null}
                  </div>
                ))}
                <div className="flex items-center gap-4">
                  <svg
                    className="text-muted-foreground h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  <div className="flex gap-4">
                    {["Relay", "Analyze"].map((step) => (
                      <div
                        key={step}
                        className="flex flex-col items-center gap-2"
                      >
                        <div className="bg-muted border-border text-muted-foreground flex h-16 w-16 items-center justify-center rounded-lg border">
                          <div className="bg-muted-foreground/30 h-8 w-8 rounded" />
                        </div>
                        <span className="text-foreground text-sm font-semibold">
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Philosophy Section */}
        <section className="border-border bg-card relative border-t py-24">
          <div className="container mx-auto px-4 lg:px-8 xl:max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-foreground mb-4 text-4xl font-black">
                PHILOSOPHY
              </h2>
              <h3 className="text-foreground mb-6 text-3xl font-bold">
                SOVEREIGN INFRASTRUCTURE
              </h3>
              <p className="text-muted-foreground mb-8 text-lg">
                No key custody. No growth hacks. Protocol-first. Designed for
                serious operators.
              </p>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </>
  );
}

export default HomePage;
