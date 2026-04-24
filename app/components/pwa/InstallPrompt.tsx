/**
 * PWA / “Add to Home Screen” install UI — presentational pieces only.
 *
 * Visually secondary to {@link PlanUsageSidebar}: lighter card surface and a
 * compact CTA on desktop (`lg+`). Full-width CTA on small viewports only.
 */
import { Share, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import { SIDEBAR_UTILITY_INSTALL_CARD_CLASS } from "~/components/layout/sidebar-utility-styles";
import { cn } from "~/lib/utils";

const REGION_LABEL = "Install SmartFlowSocial";

/** Sidebar-selected accent family, toned down vs. primary plan card. */
const INSTALL_CTA_ACCENT =
  "focus-ring motion-fast tap-target flex h-8 w-full items-center justify-center rounded-lg border border-border-subtle/55 bg-surface-selected/40 px-3 text-[11px] font-medium text-text shadow-none hover:bg-surface-hover hover:text-text active:border-border dark:border-border-subtle/45 dark:bg-surface-selected/28 lg:h-7 lg:min-w-[5.25rem] lg:w-auto";

const INSTALL_CTA_MUTED =
  "focus-ring motion-fast tap-target flex h-8 w-full items-center justify-center rounded-lg border border-transparent bg-transparent px-3 text-[11px] font-medium text-text-secondary shadow-none hover:bg-surface-hover hover:text-text active:border-border lg:h-7 lg:min-w-[4.75rem] lg:w-auto";

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
        "w-full shrink-0",
        "hidden max-lg:block",
        isDesktopExpanded ? "lg:block" : "lg:hidden",
        "[@media(max-height:660px)]:hidden",
        "[@media(min-width:1024px)_and_(max-height:500px)]:hidden"
      )}
    >
      <div className={cn(SIDEBAR_UTILITY_INSTALL_CARD_CLASS, "relative")}>
        <button
          type="button"
          aria-label="Dismiss install prompt"
          onClick={dismiss}
          className="text-text-tertiary hover:text-text hover:bg-surface-hover/70 focus-ring-offset absolute top-0 right-0 inline-flex size-6 items-center justify-center rounded-md"
        >
          <X className="size-3.5" strokeWidth={2} aria-hidden />
        </button>

        <div className="flex gap-1 pr-5">
          <img
            src="/Logo-NoText.svg"
            alt=""
            aria-hidden
            className="size-3.5 shrink-0 self-start rounded opacity-85"
          />
          <div className="min-w-0 flex-1 pt-px">
            <p className="text-text-secondary text-[10px] leading-snug">
              <span className="text-text/90 font-medium">{PANEL_TITLE}</span>
              <span className="text-text-tertiary" aria-hidden>
                {" "}
                ·{" "}
              </span>
              <span>{PANEL_SUBTITLE}</span>
            </p>
          </div>
        </div>

        <div className="mt-0.5 flex w-full flex-col items-stretch gap-0.5 lg:flex-row lg:justify-end">
          {isIos ? (
            <>
              {iosInstructionsOpen ? (
                <ol className="text-text-secondary border-border-subtle/55 w-full space-y-0.5 border-t border-dashed pt-1 text-[10px] leading-snug lg:order-first lg:mr-auto lg:max-w-[11rem] lg:border-0 lg:pt-0">
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
            </>
          ) : (
            <button
              type="button"
              className={INSTALL_CTA_ACCENT}
              aria-label="Install SmartFlowSocial app"
              onClick={onChromiumInstall}
            >
              Install
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
