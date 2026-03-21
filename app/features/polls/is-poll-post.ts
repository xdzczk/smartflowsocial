import type { CombinedContent } from "~/features/posts/types";

import { KIND_POLL } from "./nip88";

/** True when this flow/calendar item is a NIP-88 poll (DB or signed event). */
export function isPollPostItem(
  item: Pick<CombinedContent, "type" | "postType" | "signedEvent">
): boolean {
  if (item.type !== "post") return false;
  if (item.postType === "POLL") return true;
  return item.signedEvent?.kind === KIND_POLL;
}
