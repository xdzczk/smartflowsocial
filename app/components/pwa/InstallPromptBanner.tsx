/**
 * InstallPromptBanner — dismissible "Install SmartFlow" affordance.
 *
 * Two modes:
 *   1. Chromium (Android/desktop): captures `beforeinstallprompt`, renders a
 *      single Install button that fires the native prompt.
 *   2. iOS Safari: no programmatic install exists, so we render a short
 *      how-to ("Share → Add to Home Screen") behind a disclosure.
 *
 * Dismissal persists for 30 days. Already-installed (standalone) sessions are
 * always hidden — see useInstallPrompt for the logic.
 *
 * Mount this once at a layout boundary (DashboardLayoutPage) — it SSR-renders
 * nothing and only appears on the client once the install affordance resolves.
 */
import { Bell, Share, WifiOff, X, Zap } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "~/components/ui/button";
import { useInstallPrompt } from "~/lib/hooks/useInstallPrompt";

const BENEFIT_CHIPS = [
  { icon: Zap, label: "Instant access" },
  { icon: Bell, label: "Push notifications" },
  { icon: WifiOff, label: "Works offline" },
] as const;

function BannerShell({
  onDismiss,
  children,
}: {
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label="Install SmartFlow"
      className="animate-slide-up border-border-subtle bg-surface shadow-2 fixed right-3 bottom-3 left-3 z-40 mx-auto max-w-sm overflow-hidden rounded-xl border sm:right-4 sm:bottom-4 sm:left-4 md:left-auto md:w-80"
    >
      {/* Brand accent stripe */}
      <div className="bg-brand h-[3px] w-full" />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <img
            src="/Logo-NoText.svg"
            alt=""
            aria-hidden
            className="h-10 w-10 shrink-0 rounded-lg"
          />
          <div className="min-w-0 flex-1">
            <p className="text-text text-[15px] leading-snug font-semibold">
              Install SmartFlow
            </p>
            <p className="text-text-secondary mt-0.5 text-xs leading-snug">
              The full-screen app — right on your home screen.
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss install prompt"
            onClick={onDismiss}
            className="text-text-secondary hover:text-text hover:bg-surface-hover focus-ring motion-fast tap-target -mt-0.5 -mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Benefit chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {BENEFIT_CHIPS.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="text-brand bg-brand-soft/20 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
            >
              <Icon className="h-3 w-3 shrink-0" aria-hidden />
              {label}
            </span>
          ))}
        </div>

        {children}
      </div>
    </div>
  );
}

export function InstallPromptBanner() {
  const {
    canPrompt,
    isIosSafariInstallable,
    triggerPrompt,
    dismiss,
    shouldRender,
  } = useInstallPrompt();
  const [iosInstructionsOpen, setIosInstructionsOpen] = useState(false);

  const handleInstallClick = useCallback(async () => {
    const accepted = await triggerPrompt();
    if (!accepted) {
      dismiss();
    }
  }, [triggerPrompt, dismiss]);

  if (!shouldRender) return null;

  // iOS: show Apple's Share → A2HS walkthrough.
  if (!canPrompt && isIosSafariInstallable) {
    return (
      <BannerShell onDismiss={dismiss}>
        {iosInstructionsOpen ? (
          <ol className="text-text-secondary mt-3 space-y-1.5 text-xs leading-snug">
            <li className="flex items-center gap-1.5">
              <span className="text-text font-semibold">1.</span>
              Tap
              <Share
                className="text-brand mx-0.5 inline h-3.5 w-3.5"
                aria-label="iOS Share icon"
              />
              <span className="font-medium">Share</span> in the Safari toolbar.
            </li>
            <li>
              <span className="text-text font-semibold">2.</span> Choose{" "}
              <span className="font-medium">
                &ldquo;Add to Home Screen&rdquo;
              </span>
              .
            </li>
            <li>
              <span className="text-text font-semibold">3.</span> Tap{" "}
              <span className="font-medium">Add</span> in the top-right corner.
            </li>
          </ol>
        ) : null}

        <div className="mt-4 flex flex-col gap-2">
          <Button
            size="sm"
            variant={iosInstructionsOpen ? "outline" : "default"}
            className="w-full"
            onClick={() => setIosInstructionsOpen((v) => !v)}
          >
            {iosInstructionsOpen ? "Got it" : "Show me how"}
          </Button>
          <button
            type="button"
            onClick={dismiss}
            className="text-text-tertiary hover:text-text-secondary motion-fast w-full py-1 text-center text-xs"
          >
            Not now
          </button>
        </div>
      </BannerShell>
    );
  }

  // Chromium / desktop: native prompt available.
  return (
    <BannerShell onDismiss={dismiss}>
      <div className="mt-4 flex flex-col gap-2">
        <Button
          size="sm"
          className="w-full"
          onClick={() => {
            void handleInstallClick();
          }}
        >
          Add to Home Screen
        </Button>
        <button
          type="button"
          onClick={dismiss}
          className="text-text-tertiary hover:text-text-secondary motion-fast w-full py-1 text-center text-xs"
        >
          Not now
        </button>
      </div>
    </BannerShell>
  );
}
