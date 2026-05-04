export type ComposeContentType = "post" | "poll" | "thread" | "article";
export type ComposerMode =
  | "create"
  | "edit_draft"
  | "edit_scheduled"
  | "edit_follow_up";

export type ComposerContext =
  | { mode: "create" }
  | { mode: "edit_draft"; draftId: string }
  | { mode: "edit_scheduled"; scheduledActionId: string }
  | {
      mode: "edit_follow_up";
      followUpActionId: string;
      parentActionId?: string;
    };

interface ComposerContextParseResult {
  context: ComposerContext;
  error: string | null;
}

interface LongformDispatchInput {
  queryType: string | null;
  contentType: string | null;
  actionType: string | null;
}

const LONGFORM_ACTIONS = new Set([
  "upload-image",
  "publish",
  "schedule-longform",
]);

export function normalizeComposeType(type: string | null): ComposeContentType {
  if (type === "poll" || type === "thread" || type === "article") {
    return type;
  }
  return "post";
}

export function getComposeMode(type: string | null): "shortform" | "article" {
  return normalizeComposeType(type) === "article" ? "article" : "shortform";
}

export function shouldDispatchToLongform({
  queryType,
  contentType,
  actionType,
}: LongformDispatchInput): boolean {
  if (contentType === "article") return true;
  if (getComposeMode(queryType) === "article") return true;
  return Boolean(actionType && LONGFORM_ACTIONS.has(actionType));
}

function isComposerMode(value: string | null): value is ComposerMode {
  return (
    value === "create" ||
    value === "edit_draft" ||
    value === "edit_scheduled" ||
    value === "edit_follow_up"
  );
}

export function parseComposerContext(
  params: URLSearchParams
): ComposerContextParseResult {
  const modeRaw = params.get("mode");
  const legacyDraftId = params.get("draftId");
  const id = params.get("id");
  const parentActionIdRaw = params.get("parentActionId");

  if (!modeRaw || modeRaw.trim() === "") {
    if (legacyDraftId && legacyDraftId.trim() !== "") {
      return {
        context: { mode: "edit_draft", draftId: legacyDraftId },
        error: null,
      };
    }
    return { context: { mode: "create" }, error: null };
  }

  if (!isComposerMode(modeRaw)) {
    return {
      context: { mode: "create" },
      error: `Unsupported compose mode: ${modeRaw}`,
    };
  }

  if (modeRaw === "create") {
    return { context: { mode: "create" }, error: null };
  }

  if (!id || id.trim() === "") {
    return {
      context: { mode: "create" },
      error: `Missing id for mode: ${modeRaw}`,
    };
  }

  if (modeRaw === "edit_draft") {
    return { context: { mode: "edit_draft", draftId: id }, error: null };
  }
  if (modeRaw === "edit_scheduled") {
    return {
      context: { mode: "edit_scheduled", scheduledActionId: id },
      error: null,
    };
  }
  return {
    context: {
      mode: "edit_follow_up",
      followUpActionId: id,
      ...(parentActionIdRaw && parentActionIdRaw.trim() !== ""
        ? { parentActionId: parentActionIdRaw }
        : {}),
    },
    error: null,
  };
}

export function buildComposeEditUrl(
  context: ComposerContext,
  options?: { composeType?: ComposeContentType }
): string {
  if (context.mode === "create") return "/dashboard/compose?type=post";

  const params = new URLSearchParams();
  const composeType = options?.composeType ?? "post";
  params.set("type", composeType === "article" ? "article" : "post");
  params.set("mode", context.mode);
  if (context.mode === "edit_draft") {
    params.set("id", context.draftId);
  } else if (context.mode === "edit_scheduled") {
    params.set("id", context.scheduledActionId);
  } else {
    params.set("id", context.followUpActionId);
    if (context.parentActionId) {
      params.set("parentActionId", context.parentActionId);
    }
  }
  return `/dashboard/compose?${params.toString()}`;
}

/** Create flow URL with optional queue preselection (`queue` = queue name). */
export function buildComposeCreateUrl(options?: {
  type?: ComposeContentType;
  queue?: string | null;
}): string {
  const type = options?.type ?? "post";
  const params = new URLSearchParams();
  params.set("type", type);
  const q = options?.queue?.trim();
  if (q) params.set("queue", q);
  return `/dashboard/compose?${params.toString()}`;
}
