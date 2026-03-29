/** Which relay list preset the composer modal is editing. */
export type ComposerRelayListSource = "default" | "app" | "nip65_profile";

/** User setting: which list is the account default for publishing. */
export type AccountPublishRelaySource = "app" | "nip65_profile";

/** Execution relay lists for the post target modal (each includes enabled managed relays). */
export interface ComposerRelayLists {
  default: string[];
  app: string[];
  nip65Profile: string[];
}
