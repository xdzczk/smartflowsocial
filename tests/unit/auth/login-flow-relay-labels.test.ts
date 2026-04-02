import { describe, expect, it } from "vitest";

import {
  getRelayStatusLabel,
  getRelayStatusUserLabel,
} from "~/features/auth/login-flow.client";

describe("getRelayStatusUserLabel", () => {
  it("uses Unreachable instead of Failed for product UI", () => {
    expect(getRelayStatusUserLabel("failed")).toBe("Unreachable");
    expect(getRelayStatusLabel("failed")).toBe("Failed");
  });

  it("matches connected and checking intent", () => {
    expect(getRelayStatusUserLabel("connected")).toBe("Connected");
    expect(getRelayStatusUserLabel("checking")).toBe("Checking");
  });
});
