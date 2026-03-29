/** NIP-65 third-field marker: omitted = read+write. */

export type Nip65RelayScope = "both" | "read" | "write";

export interface Nip65ProfileRelayEntry {
  url: string;
  scope: Nip65RelayScope;
}
