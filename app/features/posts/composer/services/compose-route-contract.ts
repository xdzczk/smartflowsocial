export type ComposeContentType = "post" | "poll" | "thread" | "article";

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
