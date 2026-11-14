import { describe, expect, it } from "vitest";

import {
  amountSatsFromMillisatoshis,
  readBolt11ForPayout,
} from "~/features/referral/bolt11-invoice.server";

const KNOWN_INVOICE =
  "lnbc20u1p3y0x3hpp5743k2g0fsqqxj7n8qzuhns5gmkk4djeejk3wkp64ppevgekvc0jsdqcve5kzar2v9nr5gpqd4hkuetesp5ez2g297jduwc20t6lmqlsg3man0vf2jfd8ar9fh8fhn2g8yttfkqxqy9gcqcqzys9qrsgqrzjqtx3k77yrrav9hye7zar2rtqlfkytl094dsp0ms5majzth6gt7ca6uhdkxl983uywgqqqqlgqqqvx5qqjqrzjqd98kxkpyw0l9tyy8r8q57k7zpy9zjmh6sez752wj6gcumqnj3yxzhdsmg6qq56utgqqqqqqqqqqqeqqjq7jd56882gtxhrjm03c93aacyfy306m4fq0tskf83c0nmet8zc2lxyyg3saz8x6vwcp26xnrlagf9semau3qm2glysp7sv95693fphvsp54l567";
const KNOWN_TIMESTAMP_MS = 1648859703 * 1000;

describe("bolt11 invoice reading", () => {
  it("reads the amount and payment hash from a mainnet invoice", () => {
    const result = readBolt11ForPayout(KNOWN_INVOICE, KNOWN_TIMESTAMP_MS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.amountSats).toBe(2000);
    expect(result.paymentHash).toBe(
      "f5636521e98000697a6700b979c288ddad56cb3995a2eb07550872c466ccc3e5"
    );
  });

  it("rejects an expired invoice", () => {
    const result = readBolt11ForPayout(KNOWN_INVOICE, Date.now());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("expired");
  });

  it("rejects malformed invoices", () => {
    expect(readBolt11ForPayout("").ok).toBe(false);
    expect(readBolt11ForPayout("not-an-invoice").ok).toBe(false);
    expect(readBolt11ForPayout("lnbc1notvalid").ok).toBe(false);
  });

  it("rejects amountless and sub-sat amounts", () => {
    expect(amountSatsFromMillisatoshis(undefined).ok).toBe(false);
    expect(amountSatsFromMillisatoshis(null).ok).toBe(false);
    const fractional = amountSatsFromMillisatoshis("1500");
    expect(fractional.ok).toBe(false);
    const whole = amountSatsFromMillisatoshis("2000000");
    expect(whole).toEqual({ ok: true, amountSats: 2000 });
  });
});
