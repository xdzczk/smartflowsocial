import type { Nip65ProfileRelayEntry } from "~/features/relays/nip65-relay-entry";

export type ProfileRowState = Nip65ProfileRelayEntry & { clientId: string };
