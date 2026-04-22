/**
 * @vitest-environment jsdom
 *
 * PR 4: render contract for the two ephemeral signing presentation tiers.
 *
 * These tests guard:
 *   - `SubtleSignPending` renders the inline spinner only for ephemeral
 *     attempts in non-terminal states; no chrome for durable attempts.
 *   - `CompactSignStatus` renders the Resume/Cancel pill for
 *     `awaiting_signer`, the "completing…" line for `resuming`/
 *     `submitting`, the "timed out / Dismiss" pill for `expired`, and
 *     nothing for terminal states.
 *
 * The store transitions are driven through the public `signing-attempts`
 * API rather than constructing fake snapshots, so the tests double as
 * regression coverage for `awaitingSince` being threaded into the
 * snapshot.
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CompactSignStatus } from "~/features/auth/signing/components/CompactSignStatus";
import { SubtleSignPending } from "~/features/auth/signing/components/SubtleSignPending";
import {
  _resetForTests as resetSigningAttempts,
  getForegroundAttempt,
  start,
  type SigningAttempt,
} from "~/features/auth/signing/signing-attempts.client";
import {
  durableIntent,
  ephemeralIntent,
} from "~/features/auth/signing/use-recoverable-sign.client";
import { RemoteSignerTimeoutError } from "~/lib/errors";

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe("SubtleSignPending", () => {
  beforeEach(() => {
    resetSigningAttempts();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    resetSigningAttempts();
  });

  it("renders an accessible spinner for an ephemeral attempt in 'signing'", async () => {
    const sign = vi.fn().mockReturnValue(new Promise<void>(() => {}));
    start({
      performSignAndSubmit: sign,
      intent: ephemeralIntent("reaction", "Like"),
      surface: "row:1",
    });
    await flushMicrotasks();

    const attempt = getForegroundAttempt();
    render(<SubtleSignPending attempt={attempt} label="Like" />);

    const status = screen.getByTestId("subtle-sign-pending");
    expect(status).toHaveAttribute("aria-label", "Like pending");
    expect(status).toHaveAttribute("data-state", "signing");
  });

  it("renders nothing for a durable attempt", async () => {
    const sign = vi.fn().mockReturnValue(new Promise<void>(() => {}));
    start({
      performSignAndSubmit: sign,
      intent: durableIntent("composer_publish", "idem", "Publish"),
      surface: "composer",
    });
    await flushMicrotasks();

    const attempt = getForegroundAttempt();
    const { container } = render(<SubtleSignPending attempt={attempt} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the attempt is null", () => {
    const { container } = render(<SubtleSignPending attempt={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("CompactSignStatus", () => {
  beforeEach(() => {
    resetSigningAttempts();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    resetSigningAttempts();
  });

  it("renders Resume/Cancel for awaiting_signer", async () => {
    const sign = vi
      .fn()
      .mockRejectedValueOnce(new RemoteSignerTimeoutError("Bunker offline"));
    start({
      performSignAndSubmit: sign,
      intent: ephemeralIntent("reaction", "Like"),
      surface: "row:1",
    });
    await flushMicrotasks();

    const attempt = getForegroundAttempt() as SigningAttempt;
    expect(attempt.state).toBe("awaiting_signer");

    render(<CompactSignStatus attempt={attempt} actionLabel="Like" />);

    const status = screen.getByTestId("compact-sign-status");
    expect(status).toHaveAttribute("data-state", "awaiting_signer");
    expect(
      screen.getByRole("button", { name: "Resume Like now" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel Like" })
    ).toBeInTheDocument();
  });

  it("renders the timed-out pill with Dismiss for expired", async () => {
    const sign = vi
      .fn()
      .mockRejectedValueOnce(new RemoteSignerTimeoutError("Bunker offline"));
    start({
      performSignAndSubmit: sign,
      intent: ephemeralIntent("reaction", "Like"),
      surface: "row:exp",
    });
    await flushMicrotasks();

    await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
    const attempt = getForegroundAttempt() as SigningAttempt;
    expect(attempt.state).toBe("expired");

    render(<CompactSignStatus attempt={attempt} actionLabel="Like" />);
    const status = screen.getByTestId("compact-sign-status");
    expect(status).toHaveAttribute("data-state", "expired");
    expect(status).toHaveTextContent(/timed out/i);
    expect(
      screen.getByRole("button", { name: "Dismiss Like" })
    ).toBeInTheDocument();
  });

  it("renders nothing for terminal completed/failed states", async () => {
    const attemptCompleted: SigningAttempt = {
      id: "x",
      attemptId: "x",
      state: "completed",
      createdAt: 0,
      resumeUntil: null,
      awaitingSince: null,
      lastError: null,
      intent: ephemeralIntent("reaction", "Like"),
      surface: "row:done",
    };
    const { container } = render(
      <CompactSignStatus attempt={attemptCompleted} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
