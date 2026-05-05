import type { ComposerContext } from "./services/compose-route-contract";

/**
 * Normalizes `composerContext` from Remix JSON loaders (shape matches route contract).
 */
export function parseComposerContextFromLoader(raw: unknown): ComposerContext {
  if (!raw || typeof raw !== "object") return { mode: "create" };
  const obj = raw as Record<string, unknown>;
  const mode = obj["mode"];
  if (mode === "edit_draft" && typeof obj["draftId"] === "string") {
    return { mode, draftId: obj["draftId"] };
  }
  if (
    mode === "edit_scheduled" &&
    typeof obj["scheduledActionId"] === "string"
  ) {
    return { mode, scheduledActionId: obj["scheduledActionId"] };
  }
  if (
    mode === "edit_follow_up" &&
    typeof obj["followUpActionId"] === "string"
  ) {
    const parentActionId =
      typeof obj["parentActionId"] === "string"
        ? obj["parentActionId"]
        : undefined;
    return { mode, followUpActionId: obj["followUpActionId"], parentActionId };
  }
  return { mode: "create" };
}
