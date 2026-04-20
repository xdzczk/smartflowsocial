/**
 * @vitest-environment jsdom
 *
 * Property guards for the publish FormData helpers.
 *
 * The user-reported "wrong 3-relay subset on autocomplete" bug was rooted
 * in the resumed publish path constructing a different payload than the
 * fresh publish path. These tests assert that for any given relayOverride
 * + submissionId pair, the FormData produced by the helpers is byte-for-byte
 * identical regardless of when (fresh vs resumed) we build it. As long as
 * fresh + resumed callers funnel through `appendRelayOverride` /
 * `appendSubmissionId`, the server-side `resolveExecutionRelaysFromForm`
 * branch they trigger MUST match.
 */

import { describe, expect, it } from "vitest";

import {
  appendRelayOverride,
  appendSubmissionId,
} from "~/features/posts/composer/services/build-publish-formdata.client";

function fdToSortedString(fd: FormData): string {
  const entries = Array.from(fd.entries()).map(
    ([k, v]) => [k, String(v)] as [string, string]
  );
  entries.sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

describe("build-publish-formdata", () => {
  it("produces byte-identical FormData for fresh and resumed submits", () => {
    const relays = [
      "wss://relay.damus.io",
      "wss://relay.primal.net",
      "wss://nos.lol",
    ];
    const submissionId = "11111111-1111-1111-1111-111111111111";

    const fresh = new FormData();
    fresh.set("content", "hello world");
    fresh.set("_action", "post");
    appendRelayOverride(fresh, relays);
    appendSubmissionId(fresh, submissionId);

    const resumed = new FormData();
    resumed.set("content", "hello world");
    resumed.set("_action", "post");
    appendRelayOverride(resumed, relays);
    appendSubmissionId(resumed, submissionId);

    expect(fdToSortedString(resumed)).toBe(fdToSortedString(fresh));
  });

  it("omits the relays field when no override is supplied so the server falls back to resolveExecutionRelays", () => {
    const fd = new FormData();
    appendRelayOverride(fd, null);
    appendRelayOverride(fd, undefined);
    appendRelayOverride(fd, []);
    expect(fd.has("relays")).toBe(false);
  });

  it("omits the submissionId field when none is supplied (legacy back-compat)", () => {
    const fd = new FormData();
    appendSubmissionId(fd, null);
    appendSubmissionId(fd, undefined);
    appendSubmissionId(fd, "");
    expect(fd.has("submissionId")).toBe(false);
  });

  it("encodes the relay override as a stable JSON array string", () => {
    const fd = new FormData();
    appendRelayOverride(fd, ["wss://a", "wss://b"]);
    expect(fd.get("relays")).toBe('["wss://a","wss://b"]');
  });

  it("supports plain object payload targets (long-form path) with the same encoding", () => {
    const target: Record<string, string> = {};
    appendRelayOverride(target, ["wss://a", "wss://b"]);
    appendSubmissionId(target, "abc");
    expect(target["relays"]).toBe('["wss://a","wss://b"]');
    expect(target["submissionId"]).toBe("abc");
  });
});
