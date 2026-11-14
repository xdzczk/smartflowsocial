import { describe, expect, it } from "vitest";

import { isAllowedOutboundUrl } from "~/lib/outbound-url.server";

describe("outbound URL checks", () => {
  it("allows public https URLs", () => {
    expect(isAllowedOutboundUrl("https://lnurl.example.com/pay")).toBe(true);
  });

  it("rejects private, loopback, metadata, and credentialed URLs", () => {
    const blocked = [
      "https://127.0.0.1/latest",
      "https://localhost/pay",
      "https://169.254.169.254/",
      "https://10.1.2.3/pay",
      "https://192.168.1.9/pay",
      "https://2130706433/",
      "https://0177.0.0.1/",
      "https://[::1]/",
      "https://user:pass@example.com/pay",
      "https://metadata.google.internal/",
    ];
    for (const url of blocked) {
      expect(isAllowedOutboundUrl(url)).toBe(false);
    }
  });

  it("rejects plain http unless insecure http is explicitly allowed", () => {
    expect(isAllowedOutboundUrl("http://lnurl.example.com/pay")).toBe(false);
    expect(
      isAllowedOutboundUrl("http://lnurl.example.com/pay", {
        allowInsecureHttp: true,
      })
    ).toBe(true);
  });
});
