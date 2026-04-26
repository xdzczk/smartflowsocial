/**
 * PWA / “Add to Home Screen” install UI — presentational pieces only.
 *
 * Inline with the sidebar rail (no card): sidebar typography + centered Install CTA.
 */
import { Share, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import { cn } from "~/lib/utils";

const REGION_LABEL = "Install SmartFlowSocial";

const INSTALL_CTA_ACCENT =
  "focus-ring motion-fast tap-target inline-flex h-9 min-w-[5.25rem] items-center justify-center rounded-lg px-4 text-sm font-medium text-text-secondary shadow-none hover:bg-surface-hover/55 hover:text-text";

const INSTALL_CTA_MUTED =
  "focus-ring motion-fast tap-target inline-flex h-9 min-w-[4.75rem] items-center justify-center rounded-lg px-4 text-sm font-medium text-text-tertiary shadow-none hover:bg-surface-hover/55 hover:text-text-secondary";

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
        "relative w-full shrink-0 px-2.5",
        "hidden max-lg:block",
        isDesktopExpanded ? "lg:block" : "lg:hidden",
        "[@media(max-height:660px)]:hidden",
        "[@media(min-width:1024px)_and_(max-height:500px)]:hidden"
      )}
    >
      <button
        type="button"
        aria-label="Dismiss install prompt"
        onClick={dismiss}
        className="text-text-tertiary hover:text-text hover:bg-surface-hover/50 focus-ring absolute top-0 right-2 inline-flex size-8 items-center justify-center rounded-lg"
      >
        <X className="size-4" strokeWidth={2} aria-hidden />
      </button>

      <div className="flex gap-2 pr-8">
        <img
          src="/Logo-NoText.svg"
          alt=""
          aria-hidden
          className="size-4 shrink-0 self-start rounded opacity-80"
        />
        <p className="text-text-tertiary min-w-0 flex-1 text-sm leading-snug">
          <span className="text-text-secondary font-medium">{PANEL_TITLE}</span>
          <span aria-hidden> · </span>
          <span>{PANEL_SUBTITLE}</span>
        </p>
      </div>

      <div className="mt-2 flex w-full flex-col items-center gap-2">
        {isIos ? (
          <>
            {iosInstructionsOpen ? (
              <ol className="text-text-tertiary w-full space-y-1 text-sm leading-snug">
                <li>
                  <span className="text-text-secondary font-semibold">1.</span>{" "}
                  Tap{" "}
                  <Share
                    className="text-brand mx-0.5 inline size-3.5"
                    aria-label="Share"
                  />{" "}
                  Share → Add to Home Screen.
                </li>
                <li>
                  <span className="text-text-secondary font-semibold">2.</span>{" "}
                  Tap{" "}
                  <span className="text-text-secondary font-medium">Add</span>.
                </li>
              </ol>
            ) : null}
            <div className="flex w-full justify-center">
              <button
                type="button"
                className={cn(
                  iosInstructionsOpen ? INSTALL_CTA_MUTED : INSTALL_CTA_ACCENT
                )}
                aria-expanded={iosInstructionsOpen}
                aria-label={
                  iosInstructionsOpen
                    ? "Close install instructions"
                    : "Show how to add this app to your home screen"
                }
                onClick={() => setIosInstructionsOpen((v) => !v)}
              >
                {iosInstructionsOpen ? "Done" : "Install"}
              </button>
            </div>
          </>
        ) : (
          <div className="flex w-full justify-center">
            <button
              type="button"
              className={INSTALL_CTA_ACCENT}
              aria-label="Install SmartFlowSocial app"
              onClick={onChromiumInstall}
            >
              Install
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
