export type PublishSource = "immediate" | "scheduled";
export type PublishPostKind = "POST" | "THREAD" | "REPLY" | "REPOST" | "QUOTE";

export const DEFAULT_PUBLISH_SOURCE: PublishSource = "immediate";

export function normalizeQueueName(queueName?: string | null): string | null {
  if (!queueName) return null;
  const normalized = queueName.trim();
  return normalized === "" ? null : normalized;
}

export function normalizePostKind(postKind?: string | null): PublishPostKind {
  if (
    postKind === "POST" ||
    postKind === "THREAD" ||
    postKind === "REPLY" ||
    postKind === "REPOST" ||
    postKind === "QUOTE"
  ) {
    return postKind;
  }
  return "POST";
}

export function buildPublishTitle(input: {
  isLongForm: boolean;
  displayName: string;
  postKind: PublishPostKind;
}): string {
  if (input.isLongForm) {
    return `Article published as ${input.displayName}`;
  }

  if (input.postKind === "REPOST") {
    return `Repost published as ${input.displayName}`;
  }
  if (input.postKind === "REPLY") {
    return `Reply published as ${input.displayName}`;
  }
  if (input.postKind === "THREAD") {
    return `Thread post published as ${input.displayName}`;
  }

  // QUOTE stays under the normal "post" category.
  return `Post published as ${input.displayName}`;
}

export function buildPublishFallbackBody(input: {
  isLongForm: boolean;
  source: PublishSource;
  queueName: string | null;
  postKind: PublishPostKind;
}): string {
  let base = "Your post is now live on Nostr.";
  if (input.isLongForm) {
    base = "Your article is now live on Nostr.";
  } else if (input.postKind === "REPOST") {
    base = "Your repost is now live on Nostr.";
  } else if (input.postKind === "REPLY") {
    base = "Your reply is now live on Nostr.";
  } else if (input.postKind === "THREAD") {
    base = "Your thread post is now live on Nostr.";
  }

  if (input.source !== "scheduled") {
    return base;
  }

  if (input.queueName) {
    return `${base} Queue: ${input.queueName}.`;
  }
  return `${base} From your scheduled queue.`;
}

export function buildPublishTemplateKey(input: {
  isLongForm: boolean;
  source: PublishSource;
  postKind: PublishPostKind;
}): string {
  if (input.isLongForm) {
    return `publish_success_article_${input.source}`;
  }

  // QUOTE stays grouped under standard post notifications.
  const postFlavor = input.postKind === "QUOTE" ? "POST" : input.postKind;
  return `publish_success_post_${input.source}_${postFlavor.toLowerCase()}`;
}
