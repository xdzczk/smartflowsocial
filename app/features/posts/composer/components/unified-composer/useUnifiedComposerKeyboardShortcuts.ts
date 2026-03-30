import { useEffect } from "react";

export function useUnifiedComposerKeyboardShortcuts(
  disabled: boolean,
  signerReady: boolean | null,
  isTemplateMode: boolean,
  primarySubmitRef: React.RefObject<HTMLButtonElement | null>,
  draftSubmitRef: React.RefObject<HTMLButtonElement | null>
) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (!disabled) {
          if (isTemplateMode) {
            primarySubmitRef.current?.click();
          } else {
            draftSubmitRef.current?.click();
          }
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (disabled) return;
        if (isTemplateMode) {
          primarySubmitRef.current?.click();
          return;
        }
        if (signerReady === false) return;
        primarySubmitRef.current?.click();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled, signerReady, isTemplateMode, primarySubmitRef, draftSubmitRef]);
}
