/**
 * PWA / “Add to Home Screen” install UI — presentational pieces only.
 *
 * `useInstallPrompt()` runs once in DashboardHeader. The surface is
 * {@link InstallPromptSidebar}: a compact panel in the nav drawer (mobile) and
 * the expanded desktop rail (lg+). There is no bottom overlay or header chip
 * when the rail is collapsed — the prompt is hidden until the user expands the
 * sidebar or opens the mobile menu.
 */
import { Share, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const REGION_LABEL = "Install SmartFlowSocial";

const PANEL_TITLE = "Install app";
const PANEL_SUBTITLE = "Full-screen access";

export interface InstallPromptChromeProps {
  canPrompt: boolean;
  isIosSafariInstallable: boolean;
  onChromiumInstall: () => void;
  dismiss: () => void;
  iosInstructionsOpen: boolean;
  setIosInstructionsOpen: Dispatch<SetStateAction<boolean>>;
}

export interface InstallPromptSidebarProps extends InstallPromptChromeProps {
  /** When false at lg+, the nav panel is hidden (collapsed desktop rail). */
  isDesktopExpanded: boolean;
}

/**
 * Compact install utility in the sidebar / mobile drawer (above Settings).
 * Hidden on desktop when the rail is collapsed (`lg:hidden`).
 */
export function InstallPromptSidebar({
  isDesktopExpanded,
  canPrompt,
  isIosSafariInstallable,
  onChromiumInstall,
  dismiss,
  iosInstructionsOpen,
  setIosInstructionsOpen,
}: InstallPromptSidebarProps) {
  const isIos = !canPrompt && isIosSafariInstallable;

  return (
    <div
      role="region"
      aria-label={REGION_LABEL}
      className={cn(
        "mb-3.5 w-full shrink-0",
        "hidden max-lg:block",
        isDesktopExpanded ? "lg:block" : "lg:hidden",
        "[@media(min-width:1024px)_and_(max-height:520px)]:hidden"
      )}
    >
      <div className="border-border-subtle bg-surface-hover/40 relative rounded-md border px-2 py-2">
        <button
          type="button"
          aria-label="Dismiss install prompt"
          onClick={dismiss}
          className="text-text-tertiary hover:text-text hover:bg-surface-hover/80 focus-ring-offset absolute top-1 right-1 inline-flex size-6 items-center justify-center rounded-md"
        >
          <X className="size-3.5" strokeWidth={2} aria-hidden />
        </button>

        <div className="flex gap-2 pr-5">
          <img
            src="/Logo-NoText.svg"
            alt=""
            aria-hidden
            className="mt-0.5 size-6 shrink-0 rounded"
          />
          <div className="min-w-0 flex-1">
            <p className="text-text text-[11px] leading-tight font-semibold tracking-tight">
              {PANEL_TITLE}
            </p>
            <p className="text-text-secondary mt-0.5 text-[10px] leading-snug">
              {PANEL_SUBTITLE}
            </p>
          </div>
        </div>

        {isIos ? (
          <>
            {iosInstructionsOpen ? (
              <ol className="text-text-secondary border-border-subtle mt-2 space-y-1 border-t pt-2 text-[10px] leading-snug">
                <li>
                  <span className="text-text font-semibold">1.</span> Tap{" "}
                  <Share
                    className="text-brand mx-0.5 inline size-3"
                    aria-label="Share"
                  />{" "}
                  Share → Add to Home Screen.
                </li>
                <li>
                  <span className="text-text font-semibold">2.</span> Tap{" "}
                  <span className="text-text font-medium">Add</span>.
                </li>
              </ol>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="default"
              className="mt-2 h-7 w-full text-[11px] font-medium shadow-none"
              aria-expanded={iosInstructionsOpen}
              aria-label={
                iosInstructionsOpen
                  ? "Close install instructions"
                  : "Show how to add this app to your home screen"
              }
              onClick={() => setIosInstructionsOpen((v) => !v)}
            >
              {iosInstructionsOpen ? "Done" : "Install"}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="default"
            className="mt-2 h-7 w-full text-[11px] font-medium shadow-none"
            aria-label="Install SmartFlowSocial app"
            onClick={onChromiumInstall}
          >
            Install
          </Button>
        )}
      </div>
    </div>
  );
}
