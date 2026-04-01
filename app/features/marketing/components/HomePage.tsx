import {
  ArrowRight,
  BarChart3,
  CheckCircle,
  ChevronRight,
  Clock,
  FileText,
  Globe,
  LineChart,
  ListOrdered,
  Lock,
  Send,
} from "lucide-react";
import type { ReactNode } from "react";

import Footer from "~/components/layout/FrontendFooter";
import Header from "~/components/layout/FrontendHeader";
import { BRAND_NAME } from "~/lib/brand";

export function HomePage(): ReactNode {
  return (
    <>
      <div className="bg-background landing-texture relative min-h-screen">
        {/* Hero motif: uses .dark in CSS so it follows app theme (not system preference) */}
        <div className="hero-motif-bg absolute inset-0" aria-hidden />
        {/* Enhanced background gradient with micro-depth */}
        <div className="hero-gradient-light dark:hero-gradient-dark absolute inset-0" />

        <Header />

        {/* Hero Section */}
        <section className="relative container mx-auto px-4 py-12 sm:py-16 lg:px-8 lg:py-24 xl:max-w-7xl xl:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <div className="border-border bg-muted text-muted-foreground mb-6 inline-flex rounded-full border px-4 py-2 text-sm font-medium">
              Schedule your nostr content with ease!
            </div>

            <h1 className="text-foreground mb-6 text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
              OWN YOUR <span className="hero-gradient-text">CADENCE</span>
              <br />
              <span className="text-foreground dark:text-foreground/90">
                ACROSS EVERY RELAY
              </span>
            </h1>

            <p className="text-muted-foreground mx-auto mb-10 text-xl leading-relaxed lg:w-3/4 lg:text-2xl">
              Sovereign publishing infrastructure. Design the system once.
              Cadence holds indefinitely.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <a
                href="/plans"
                className="bg-primary-action text-primary-foreground hover:bg-primary-action/90 focus:ring-ring inline-flex items-center justify-center gap-2 rounded-lg px-8 py-4 text-lg font-semibold transition-colors focus:ring-2 focus:ring-offset-0 focus:outline-none"
              >
                <span>ENTER CONSOLE</span>
                <ArrowRight className="h-5 w-5" aria-hidden />
              </a>
              <a
                href="/"
                className="border-border bg-card text-foreground hover:bg-muted hover:text-foreground focus:ring-ring inline-flex items-center justify-center gap-2 rounded-lg border px-8 py-4 text-lg font-semibold transition-colors focus:ring-2 focus:ring-offset-0 focus:outline-none"
              >
                <span>Watch Demo</span>
              </a>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-border bg-card relative border-t py-16 sm:py-24 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8 xl:max-w-7xl">
            <div className="mb-16 text-center">
              <h2 className="text-foreground mb-4 text-4xl font-black">
                FLOW WITHOUT CHAOS
              </h2>
              <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
                {BRAND_NAME} links drafts, queues, automation, and analytics
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
                  icon: CheckCircle,
                  isEmphasized: true,
                },
                {
                  title: "SOVEREIGN INFRASTRUCTURE",
                  description:
                    "No key custody. No growth hacks. Protocol-first. Designed for serious operators.",
                  icon: Lock,
                  isEmphasized: false,
                },
                {
                  title: "CADENCE & FLOW",
                  description:
                    "Design your publishing cadence once. The system maintains it indefinitely.",
                  icon: Clock,
                  isEmphasized: false,
                },
                {
                  title: "ANALYTICS & INSIGHTS",
                  description:
                    "Track performance, engagement, and optimize your content strategy.",
                  icon: BarChart3,
                  isEmphasized: false,
                },
              ].map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className={`border-border card-lift rounded-lg border p-6 transition-all duration-200 ${
                      feature.isEmphasized
                        ? "bg-background shadow-xl dark:bg-[hsl(var(--landing-card-elevated))] dark:shadow-2xl"
                        : "bg-background dark:bg-card shadow-lg dark:shadow-xl"
                    }`}
                  >
                    <div className="bg-muted mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                      <Icon
                        className={`h-6 w-6 ${
                          feature.isEmphasized
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <h3 className="text-foreground mb-2 text-lg font-bold">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Process Flow Section */}
        <section className="border-border bg-background relative border-t py-16 sm:py-24 lg:py-32">
          {/* Subtle neutral gradient overlay for depth */}
          <div className="from-muted/10 to-background dark:from-muted/5 absolute inset-0 bg-gradient-to-b via-transparent" />
          <div className="relative container mx-auto px-4 lg:px-8 xl:max-w-7xl">
            <div className="mb-16 text-center">
              <h2 className="text-foreground mb-4 text-4xl font-black">
                CADENCE & FLOW
              </h2>
              <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
                FLOW WITHOUT CHAOS
              </p>
            </div>

            <div className="mx-auto max-w-4xl">
              <div className="flex flex-wrap items-center justify-center gap-6">
                {[
                  { name: "Draft", icon: FileText, isActive: true },
                  { name: "Queue", icon: ListOrdered, isActive: true },
                  { name: "Publish", icon: Send, isActive: true },
                ].map((step, idx) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.name} className="flex items-center gap-6">
                      <div className="flex flex-col items-center gap-2">
                        <div
                          className={`flex h-16 w-16 items-center justify-center rounded-lg border transition-all ${
                            step.isActive
                              ? "border-border bg-muted shadow-lg dark:bg-[hsl(var(--landing-card-elevated))]"
                              : "border-border bg-muted"
                          }`}
                        >
                          <Icon className="text-foreground h-8 w-8" />
                        </div>
                        <span className="text-foreground text-sm font-semibold">
                          {step.name}
                        </span>
                      </div>
                      {idx < 2 ? (
                        <ChevronRight className="text-muted-foreground arrow-pulse h-8 w-8" />
                      ) : null}
                    </div>
                  );
                })}
                <div className="flex items-center gap-6">
                  <ChevronRight className="text-muted-foreground arrow-pulse h-8 w-8" />
                  <div className="flex gap-6">
                    {[
                      { name: "Relay", icon: Globe, isActive: false },
                      {
                        name: "Analyze",
                        icon: LineChart,
                        isActive: false,
                      },
                    ].map((step) => {
                      const Icon = step.icon;
                      return (
                        <div
                          key={step.name}
                          className="flex flex-col items-center gap-2"
                        >
                          <div className="border-border bg-muted flex h-16 w-16 items-center justify-center rounded-lg border transition-all">
                            <Icon className="text-muted-foreground h-8 w-8" />
                          </div>
                          <span className="text-foreground text-sm font-semibold">
                            {step.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Philosophy Section */}
        <section className="border-border bg-card relative border-t py-16 sm:py-24 lg:py-32 dark:bg-[hsl(var(--landing-section-alt))]">
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
