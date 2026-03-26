export interface ComposerEventPayload {
  [key: string]: string | number | boolean | null | undefined;
}

export function trackComposerEvent(
  name: string,
  payload: ComposerEventPayload = {}
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("smartflow:composer-analytics", {
      detail: { name, payload, at: Date.now() },
    })
  );
}
