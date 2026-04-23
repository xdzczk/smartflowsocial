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
import { Download, Share, SquarePlus, X } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "~/components/ui/button";
import { useInstallPrompt } from "~/lib/hooks/useInstallPrompt";

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
      // User dismissed the native prompt — don't nag again for 30 days.
      dismiss();
    }
  }, [triggerPrompt, dismiss]);

  if (!shouldRender) return null;

  // iOS can't install programmatically; show Apple's Share → A2HS walkthrough.
  if (!canPrompt && isIosSafariInstallable) {
    return (
      <div
        role="region"
        aria-label="Install SmartFlow on your device"
        className="border-border-subtle bg-surface shadow-1 safe-x safe-pb-2 fixed right-3 bottom-3 left-3 z-40 mx-auto max-w-xl rounded-xl border p-3 sm:right-4 sm:bottom-4 sm:left-4 md:left-auto md:w-96"
      >
        <div className="flex items-start gap-3">
          <div className="bg-brand-soft/25 text-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <SquarePlus className="h-5 w-5" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-text text-sm font-semibold">Install SmartFlow</p>
            <p className="text-text-secondary mt-0.5 text-xs leading-snug">
              Get a full-screen app and push notifications.
            </p>
            {iosInstructionsOpen ? (
              <ol className="text-text-secondary mt-2 space-y-1 text-xs leading-snug">
                <li className="flex items-center gap-1.5">
                  <span className="text-text font-semibold">1.</span>
                  Tap
                  <Share
                    className="text-brand mx-0.5 inline h-3.5 w-3.5"
                    aria-label="iOS Share icon"
                  />
                  Share in the Safari toolbar.
                </li>
                <li>
                  <span className="text-text font-semibold">2.</span> Choose
                  &ldquo;Add to Home Screen&rdquo;.
                </li>
                <li>
                  <span className="text-text font-semibold">3.</span> Tap Add in
                  the top-right corner.
                </li>
              </ol>
            ) : null}
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant={iosInstructionsOpen ? "outline" : "default"}
                onClick={() => setIosInstructionsOpen((v) => !v)}
              >
                {iosInstructionsOpen ? "Hide" : "Show me how"}
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Not now
              </Button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss install prompt"
            onClick={dismiss}
            className="text-text-secondary hover:text-text hover:bg-surface-hover focus-ring motion-fast tap-target -mt-1 -mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Chromium / desktop: native prompt available.
  return (
    <div
      role="region"
      aria-label="Install SmartFlow"
      className="border-border-subtle bg-surface shadow-1 safe-x safe-pb-2 fixed right-3 bottom-3 left-3 z-40 mx-auto max-w-xl rounded-xl border p-3 sm:right-4 sm:bottom-4 sm:left-4 md:left-auto md:w-96"
    >
      <div className="flex items-start gap-3">
        <div className="bg-brand-soft/25 text-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
          <Download className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-text text-sm font-semibold">Install SmartFlow</p>
          <p className="text-text-secondary mt-0.5 text-xs leading-snug">
            Launch from your home screen — fewer taps, push notifications, and
            offline-friendly.
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                void handleInstallClick();
              }}
            >
              Install
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss install prompt"
          onClick={dismiss}
          className="text-text-secondary hover:text-text hover:bg-surface-hover focus-ring motion-fast tap-target -mt-1 -mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
