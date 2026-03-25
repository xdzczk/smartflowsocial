export function buildDraftDeepLink(draftId: string) {
  return `/dashboard/drafts?draftId=${encodeURIComponent(draftId)}`;
}

export function buildScheduledDeepLink(postId: string) {
  return `/dashboard/scheduled?postId=${encodeURIComponent(postId)}`;
}

export function buildQueueDeepLink(queueTypeId: string) {
  return `/dashboard/scheduled?queueTypeId=${encodeURIComponent(queueTypeId)}`;
}
