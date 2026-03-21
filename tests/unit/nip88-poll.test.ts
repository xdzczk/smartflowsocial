import { describe, expect, it } from "vitest";

import {
  aggregatePollVotes,
  buildPollTags,
  effectiveVoteOptionIds,
  extractRelayUrlsFromPollTags,
  KIND_POLL,
  KIND_VOTE,
  normalizeRelayUrls,
  parsePollFromSignedEvent,
  validateVoteAgainstPoll,
} from "~/features/polls";

function samplePollSigned(overrides?: Partial<{ id: string; pubkey: string }>) {
  const id = overrides?.id ?? "poll1";
  const pubkey = overrides?.pubkey ?? "abc";
  const tags: string[][] = [
    ["option", "optA", "Yay"],
    ["option", "optB", "Nay"],
    ["relay", "wss://r1.example"],
    ["relay", "wss://r2.example"],
    ["polltype", "singlechoice"],
    ["endsAt", "2000000000"],
  ];
  return {
    id,
    pubkey,
    kind: KIND_POLL,
    content: "Pineapple?",
    tags,
    created_at: 1000,
    sig: "sig",
  };
}

describe("nip88 buildPollTags", () => {
  it("requires two options and one relay", () => {
    expect(() =>
      buildPollTags({
        optionLabels: ["a"],
        pollType: "singlechoice",
        relayUrls: ["wss://x"],
      })
    ).toThrow();
    expect(() =>
      buildPollTags({
        optionLabels: ["a", "b"],
        pollType: "singlechoice",
        relayUrls: [],
      })
    ).toThrow();
  });

  it("emits option, relay, polltype, endsAt", () => {
    const tags = buildPollTags({
      optionLabels: ["Yes", "No"],
      pollType: "multiplechoice",
      relayUrls: ["wss://a", "wss://a"],
      endsAt: 1_700_000_000,
    });
    expect(tags.filter((t) => t[0] === "option").length).toBe(2);
    expect(tags.filter((t) => t[0] === "relay").length).toBe(1);
    expect(
      tags.some((t) => t[0] === "polltype" && t[1] === "multiplechoice")
    ).toBe(true);
    expect(tags.some((t) => t[0] === "endsAt" && t[1] === "1700000000")).toBe(
      true
    );
  });
});

describe("nip88 parsePollFromSignedEvent", () => {
  it("parses valid poll", () => {
    const ev = samplePollSigned();
    const p = parsePollFromSignedEvent(ev);
    expect(p).not.toBeNull();
    expect(p!.question).toBe("Pineapple?");
    expect(p!.options.map((o) => o.id)).toEqual(["optA", "optB"]);
    expect(p!.pollType).toBe("singlechoice");
    expect(p!.endsAt).toBe(2000000000);
    expect(p!.relayUrls).toEqual(["wss://r1.example", "wss://r2.example"]);
  });

  it("returns null for wrong kind", () => {
    const ev = { ...samplePollSigned(), kind: 1 };
    expect(parsePollFromSignedEvent(ev)).toBeNull();
  });

  it("defaults polltype to singlechoice", () => {
    const base = samplePollSigned();
    const tags = base.tags.filter((t) => t[0] !== "polltype");
    const p = parsePollFromSignedEvent({ ...base, tags });
    expect(p!.pollType).toBe("singlechoice");
  });
});

describe("nip88 effectiveVoteOptionIds", () => {
  it("singlechoice keeps first only", () => {
    expect(effectiveVoteOptionIds(["a", "b"], "singlechoice")).toEqual(["a"]);
  });

  it("multiplechoice dedupes order-preserving first occurrence", () => {
    expect(effectiveVoteOptionIds(["b", "a", "b"], "multiplechoice")).toEqual([
      "b",
      "a",
    ]);
  });
});

describe("nip88 validateVoteAgainstPoll", () => {
  const poll = samplePollSigned();

  it("accepts valid vote", () => {
    const vote = {
      kind: KIND_VOTE,
      created_at: 1500,
      tags: [
        ["e", "poll1"],
        ["response", "optA"],
      ],
      content: "",
      id: "v1",
      pubkey: "voter",
      sig: "s",
    };
    expect(validateVoteAgainstPoll(vote, poll).ok).toBe(true);
  });

  it("rejects wrong poll id", () => {
    const vote = {
      kind: KIND_VOTE,
      created_at: 1500,
      tags: [
        ["e", "other"],
        ["response", "optA"],
      ],
      content: "",
      id: "v1",
      pubkey: "voter",
      sig: "s",
    };
    expect(validateVoteAgainstPoll(vote, poll).ok).toBe(false);
  });

  it("rejects vote after endsAt", () => {
    const vote = {
      kind: KIND_VOTE,
      created_at: 2000000001,
      tags: [
        ["e", "poll1"],
        ["response", "optA"],
      ],
      content: "",
      id: "v1",
      pubkey: "voter",
      sig: "s",
    };
    expect(validateVoteAgainstPoll(vote, poll).ok).toBe(false);
  });

  it("rejects unknown option", () => {
    const vote = {
      kind: KIND_VOTE,
      created_at: 1500,
      tags: [
        ["e", "poll1"],
        ["response", "nope"],
      ],
      content: "",
      id: "v1",
      pubkey: "voter",
      sig: "s",
    };
    expect(validateVoteAgainstPoll(vote, poll).ok).toBe(false);
  });
});

describe("nip88 aggregatePollVotes", () => {
  const poll = parsePollFromSignedEvent(samplePollSigned())!;

  it("counts latest vote per pubkey", () => {
    const votes = [
      {
        id: "1",
        pubkey: "p1",
        kind: KIND_VOTE,
        created_at: 100,
        tags: [
          ["e", "poll1"],
          ["response", "optA"],
        ],
      },
      {
        id: "2",
        pubkey: "p1",
        kind: KIND_VOTE,
        created_at: 200,
        tags: [
          ["e", "poll1"],
          ["response", "optB"],
        ],
      },
      {
        id: "3",
        pubkey: "p2",
        kind: KIND_VOTE,
        created_at: 150,
        tags: [
          ["e", "poll1"],
          ["response", "optA"],
        ],
      },
    ];
    const { counts, totalVoters } = aggregatePollVotes(votes, poll);
    expect(counts["optA"]).toBe(1);
    expect(counts["optB"]).toBe(1);
    expect(totalVoters).toBe(2);
  });

  it("drops votes after endsAt", () => {
    const votes = [
      {
        id: "1",
        pubkey: "p1",
        kind: KIND_VOTE,
        created_at: 2000000001,
        tags: [
          ["e", "poll1"],
          ["response", "optA"],
        ],
      },
    ];
    const { counts, totalVoters } = aggregatePollVotes(votes, poll);
    expect(counts["optA"]).toBe(0);
    expect(totalVoters).toBe(0);
  });

  it("applies multiplechoice", () => {
    const multiPoll = parsePollFromSignedEvent({
      ...samplePollSigned(),
      tags: [
        ["option", "optA", "A"],
        ["option", "optB", "B"],
        ["relay", "wss://r"],
        ["polltype", "multiplechoice"],
      ],
    })!;
    const votes = [
      {
        id: "1",
        pubkey: "p1",
        kind: KIND_VOTE,
        created_at: 100,
        tags: [
          ["e", "poll1"],
          ["response", "optA"],
          ["response", "optB"],
        ],
      },
    ];
    const { counts, totalVoters } = aggregatePollVotes(votes, multiPoll);
    expect(counts["optA"]).toBe(1);
    expect(counts["optB"]).toBe(1);
    expect(totalVoters).toBe(1);
  });
});

describe("normalizeRelayUrls", () => {
  it("dedupes and trims", () => {
    expect(normalizeRelayUrls([" wss://a ", "wss://a", ""])).toEqual([
      "wss://a",
    ]);
  });
});

describe("extractRelayUrlsFromPollTags", () => {
  it("collects relay tags", () => {
    expect(
      extractRelayUrlsFromPollTags([
        ["relay", "wss://x"],
        ["t", "foo"],
      ])
    ).toEqual(["wss://x"]);
  });
});
