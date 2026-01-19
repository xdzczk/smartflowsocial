import { ProfileMismatchError, ValidationError } from "~/lib/errors";

export function assertSignedEventMatchesSessionPubkey(input: {
  sessionPubkey: string;
  eventPubkey: string | null | undefined;
  context?: Record<string, unknown>;
}): void {
  const eventPubkey =
    typeof input.eventPubkey === "string" ? input.eventPubkey : "";
  if (!eventPubkey) {
    throw new ValidationError("Missing signed event pubkey", input.context);
  }
  if (eventPubkey !== input.sessionPubkey) {
    throw new ProfileMismatchError(undefined, {
      sessionPubkey: input.sessionPubkey,
      eventPubkey,
      ...input.context,
    });
  }
}
