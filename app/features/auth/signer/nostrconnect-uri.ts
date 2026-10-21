/**
 * Minimal `nostrconnect://` URI parser (NIP-46 client-initiated flow).
 *
 * nostr-tools removed `parseNostrConnectURI` from `nostr-tools/nip46` in a
 * minor release; we only need the client pubkey and the query parameters to
 * rebuild the URI with an extended relay list, so keep a small local parser.
 */

const SCHEME = "nostrconnect://";

export interface ParsedNostrConnectURI {
  clientPubkey: string;
  params: {
    relays: string[];
    secret: string;
    perms?: string[];
    name?: string;
    url?: string;
    image?: string;
  };
}

export function parseNostrConnectURI(uri: string): ParsedNostrConnectURI {
  if (!uri.startsWith(SCHEME)) {
    throw new Error(
      'Invalid nostrconnect URI: Must start with "nostrconnect://".'
    );
  }
  const queryIndex = uri.indexOf("?");
  if (queryIndex === -1) {
    throw new Error("Invalid nostrconnect URI: Missing query string.");
  }
  const clientPubkey = uri.slice(SCHEME.length, queryIndex);
  if (!clientPubkey) {
    throw new Error("Invalid nostrconnect URI: Missing client-pubkey.");
  }
  const query = new URLSearchParams(uri.slice(queryIndex + 1));
  const relays = query.getAll("relay");
  if (relays.length === 0) {
    throw new Error('Invalid nostrconnect URI: Missing "relay" parameter.');
  }
  const secret = query.get("secret");
  if (!secret) {
    throw new Error('Invalid nostrconnect URI: Missing "secret" parameter.');
  }
  const permsString = query.get("perms");
  return {
    clientPubkey,
    params: {
      relays,
      secret,
      perms: permsString ? permsString.split(",") : undefined,
      name: query.get("name") ?? undefined,
      url: query.get("url") ?? undefined,
      image: query.get("image") ?? undefined,
    },
  };
}
