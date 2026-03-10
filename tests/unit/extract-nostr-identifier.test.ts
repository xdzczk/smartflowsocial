/**
 * Unit tests for extract Nostr identifier utility
 * Tests app/lib/extract-nostr-identifier.ts
 */

import { describe, it, expect } from "vitest";

import { extractNostrIdentifier } from "~/lib/extract-nostr-identifier";

describe("extractNostrIdentifier", () => {
  it("returns null for empty string", () => {
    expect(extractNostrIdentifier("")).toBeNull();
  });

  it("returns null for whitespace only", () => {
    expect(extractNostrIdentifier("   ")).toBeNull();
  });

  it("returns rest after nostr: prefix for note1", () => {
    const id = "note1abc123def";
    expect(extractNostrIdentifier(`nostr:${id}`)).toBe(id);
  });

  it("returns rest after nostr: prefix for nevent1", () => {
    const id = "nevent1qvzqqqr4gupz";
    expect(extractNostrIdentifier(`nostr:${id}`)).toBe(id);
  });

  it("returns rest after nostr: prefix for naddr1", () => {
    const id = "naddr1qvzqqqr4gupz";
    expect(extractNostrIdentifier(`nostr:${id}`)).toBe(id);
  });

  it("returns raw note1 as-is", () => {
    const id = "note1abc123";
    expect(extractNostrIdentifier(id)).toBe(id);
  });

  it("returns raw nevent1 as-is", () => {
    const id = "nevent1qvzqqqr4gupz";
    expect(extractNostrIdentifier(id)).toBe(id);
  });

  it("returns raw naddr1 as-is", () => {
    const id = "naddr1qvzqqqr4gupz";
    expect(extractNostrIdentifier(id)).toBe(id);
  });

  it("returns 64-char hex as-is", () => {
    const hex = "a".repeat(64);
    expect(extractNostrIdentifier(hex)).toBe(hex);
  });

  it("returns 64-char hex case insensitive", () => {
    const hex = "AbCdEf" + "0".repeat(58);
    expect(extractNostrIdentifier(hex)).toBe(hex);
  });

  it("extracts bech32 from URL (Primal-style)", () => {
    const bech32 = "naddr1qvzqqqr4gupz9pu2vw";
    const url = `https://primal.net/a/${bech32}`;
    const result = extractNostrIdentifier(url);
    expect(result).toBe(bech32);
  });

  it("returns null when no identifier in string", () => {
    expect(extractNostrIdentifier("https://example.com/page")).toBeNull();
    expect(extractNostrIdentifier("hello world")).toBeNull();
  });

  it("trims input", () => {
    expect(extractNostrIdentifier("  note1abc  ")).toBe("note1abc");
  });
});
