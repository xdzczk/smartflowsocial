/**
 * PWA / “Add to Home Screen” install UI — presentational pieces only.
 *
 * Sidebar rail: same icon/typography language as main nav; light outline, no centered CTAs.
 */
import { Share, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import { cn } from "~/lib/utils";

const REGION_LABEL = "Install SmartFlowSocial";

/** PWA / manifest artwork (see public/manifest.json). */
const APP_ICON_SRC = "/AppIcon.svg";

/** Match DashboardHeader nav icons: 18px, stroke 2.25 */
const SIDEBAR_ICON_CLASS = "inline-block size-[18px] shrink-0";
const SIDEBAR_ICON_STROKE = 2.25;

const INSTALL_CTA_CLASS =
  "focus-ring motion-fast tap-target flex h-9 w-full items-center rounded-lg px-2.5 text-left text-sm font-medium text-text-secondary shadow-none hover:bg-surface-hover/55 hover:text-text";

const INSTALL_CTA_MUTED =
  "focus-ring motion-fast tap-target flex h-9 w-full items-center rounded-lg px-2.5 text-left text-sm font-medium text-text-tertiary shadow-none hover:bg-surface-hover/55 hover:text-text-secondary";

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
        "border-border-subtle/50 dark:border-border-subtle/35 relative w-full shrink-0 rounded-lg border px-2.5 py-2",
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
        className="text-text-tertiary hover:text-text hover:bg-surface-hover/50 focus-ring absolute top-1.5 right-1.5 inline-flex size-8 items-center justify-center rounded-lg"
      >
        <X
          className={SIDEBAR_ICON_CLASS}
          strokeWidth={SIDEBAR_ICON_STROKE}
          aria-hidden
        />
      </button>

      <div className="flex gap-2 pr-9">
        <span className="flex flex-none items-start pt-0.5">
          <img
            src={APP_ICON_SRC}
            alt=""
            width={18}
            height={18}
            className="size-[18px] shrink-0 rounded-[4px] object-cover"
            aria-hidden
          />
        </span>
        <p className="text-text-tertiary min-w-0 flex-1 text-sm leading-normal">
          <span className="text-text-secondary font-medium">{PANEL_TITLE}</span>
          <span aria-hidden> · </span>
          <span>{PANEL_SUBTITLE}</span>
        </p>
      </div>

      <div className="mt-2 flex w-full flex-col gap-2">
        {isIos ? (
          <>
            {iosInstructionsOpen ? (
              <ol className="text-text-tertiary space-y-1 text-sm leading-normal">
                <li>
                  <span className="text-text-secondary font-semibold">1.</span>{" "}
                  Tap{" "}
                  <Share
                    className="text-brand mx-0.5 inline size-[18px] align-middle"
                    strokeWidth={SIDEBAR_ICON_STROKE}
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
            <button
              type="button"
              className={cn(
                iosInstructionsOpen ? INSTALL_CTA_MUTED : INSTALL_CTA_CLASS
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
            className={INSTALL_CTA_CLASS}
            aria-label="Install SmartFlowSocial app"
            onClick={onChromiumInstall}
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}
