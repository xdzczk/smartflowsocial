/** JSON payload returned when the composer is embedded in contest creation and publish succeeds. */
export interface ContestEmbedPublishPayload {
  ok: true;
  embedContext: "contest";
  postId: string;
  nostrEventId: string | null;
  caption: string | null;
  publishedAt: string | null;
}
