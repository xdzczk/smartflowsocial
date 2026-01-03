/**
 * EditorJS caption removal utilities
 */

/**
 * Disable captions in EditorJS image blocks
 */
export function disableCaptions() {
  const captions = document.querySelectorAll(
    ".image-tool__caption, .image-tool .cdx-input",
  );
  captions.forEach((caption) => {
    if (caption) {
      (caption as HTMLElement).style.display = "none";
      caption.remove();
    }
  });
}

/**
 * Setup mutation observer to remove captions whenever they appear
 */
export function setupCaptionObserver(
  editorElement: HTMLElement,
  disableCaptionsFn: () => void,
): MutationObserver {
  const captionObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "childList") {
        setTimeout(disableCaptionsFn, 10);
      }
    });
  });

  captionObserver.observe(editorElement, {
    childList: true,
    subtree: true,
  });

  return captionObserver;
}


