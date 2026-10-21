import { describe, expect, it } from "vitest";

import { parseNostrConnectURI } from "~/features/auth/signer/nostrconnect-uri";

const PUBKEY = "a".repeat(64);

describe("parseNostrConnectURI", () => {
  it("parses pubkey, relays, secret and optional params", () => {
    const uri =
      `nostrconnect://${PUBKEY}?relay=wss%3A%2F%2Fr1.example&relay=wss%3A%2F%2Fr2.example` +
      "&secret=s3cret&perms=sign_event%3A1%2Cnip04_encrypt&name=SmartFlow&url=https%3A%2F%2Fapp.example&image=https%3A%2F%2Fapp.example%2Fi.png";

    expect(parseNostrConnectURI(uri)).toEqual({
      clientPubkey: PUBKEY,
      params: {
        relays: ["wss://r1.example", "wss://r2.example"],
        secret: "s3cret",
        perms: ["sign_event:1", "nip04_encrypt"],
        name: "SmartFlow",
        url: "https://app.example",
        image: "https://app.example/i.png",
      },
    });
  });

  it("leaves optional params undefined when absent", () => {
    const parsed = parseNostrConnectURI(
      `nostrconnect://${PUBKEY}?relay=wss%3A%2F%2Fr.example&secret=x`
    );
    expect(parsed.params.perms).toBeUndefined();
    expect(parsed.params.name).toBeUndefined();
    expect(parsed.params.url).toBeUndefined();
    expect(parsed.params.image).toBeUndefined();
  });

  it.each([
    ["bunker://abc?relay=wss%3A%2F%2Fr&secret=x", /must start with/i],
    ["nostrconnect://abc", /missing query string/i],
    ["nostrconnect://?relay=wss%3A%2F%2Fr&secret=x", /missing client-pubkey/i],
    [`nostrconnect://${PUBKEY}?secret=x`, /missing "relay"/i],
    [`nostrconnect://${PUBKEY}?relay=wss%3A%2F%2Fr`, /missing "secret"/i],
  ])("rejects %s", (uri, message) => {
    expect(() => parseNostrConnectURI(uri)).toThrow(message);
  });
});
