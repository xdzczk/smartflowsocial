/**
 * @vitest-environment jsdom
 * Tests ComposerErrors: "Waiting for signer approval" banner and Cancel calling tryBackgroundReconnect.
 */
/// <reference types="@testing-library/jest-dom" />

import { render, screen, fireEvent, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTryBackgroundReconnect = vi.fn();
vi.mock("~/features/auth/signer", () => ({
  tryBackgroundReconnect: (...args: unknown[]) =>
    mockTryBackgroundReconnect(...args),
}));

import { ComposerErrors } from "~/features/posts/composer/components/composer/ComposerErrors";

describe("ComposerErrors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Waiting for signer approval banner when isSigning is true", () => {
    render(
      <ComposerErrors
        isSigning={true}
        signerLabel="Remote signer"
        onCancelSigning={vi.fn()}
        signingError={null}
        onDismissSigningError={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(
      screen.getByText(/Waiting for signer approval/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/remote signer|open it to approve/i)
    ).toBeInTheDocument();
  });

  it("does not show banner when isSigning is false", () => {
    const { container } = render(
      <ComposerErrors
        isSigning={false}
        signerLabel={null}
        onCancelSigning={vi.fn()}
        signingError={null}
        onDismissSigningError={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(container).not.toHaveTextContent(/Waiting for signer approval/i);
  });

  it("calls onCancelSigning and tryBackgroundReconnect when Cancel is clicked", () => {
    const onCancelSigning = vi.fn();
    const { container } = render(
      <ComposerErrors
        isSigning={true}
        signerLabel="Remote signer"
        onCancelSigning={onCancelSigning}
        signingError={null}
        onDismissSigningError={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    const cancelButton = within(container).getByRole("button", {
      name: /cancel/i,
    });
    fireEvent.click(cancelButton);

    expect(onCancelSigning).toHaveBeenCalledTimes(1);
    expect(mockTryBackgroundReconnect).toHaveBeenCalledTimes(1);
  });

  it("shows NIP-07 message when signerLabel is NIP-07 extension", () => {
    render(
      <ComposerErrors
        isSigning={true}
        signerLabel="NIP-07 extension"
        onCancelSigning={vi.fn()}
        signingError={null}
        onDismissSigningError={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(
      screen.getByText(/Approve the request in your browser extension/i)
    ).toBeInTheDocument();
  });

  it("shows signing error alert when signingError is set", () => {
    render(
      <ComposerErrors
        isSigning={false}
        signerLabel={null}
        onCancelSigning={vi.fn()}
        signingError="Remote signer did not respond."
        onDismissSigningError={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(
      screen.getByText("Remote signer did not respond.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /try again/i })
    ).toBeInTheDocument();
  });
});
