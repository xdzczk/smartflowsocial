/**
 * @vitest-environment jsdom
 */
/// <reference types="@testing-library/jest-dom" />

import type * as RemixReact from "@remix-run/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@remix-run/react", async () => {
  const actual = await vi.importActual<typeof RemixReact>("@remix-run/react");
  return {
    ...actual,
    useMatches: () => [],
    useNavigation: () => ({ state: "idle", location: undefined }),
    useFetcher: () => ({
      state: "idle",
      data: undefined,
      submit: vi.fn(),
      formData: undefined,
    }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock("~/features/posts/calendar", () => ({
  canScheduleRepostQuoteForPost: () => true,
  getFirstMediaFromFileUrl: () => "https://example.com/media.png",
  submitQuoteSchedule: vi.fn(),
  submitRepostSchedule: vi.fn(),
}));

vi.mock("~/features/posts/composer/hooks/useComposerSignerReconnect", () => ({
  useComposerSignerReconnect: vi.fn(),
}));

vi.mock("~/features/posts/utils/repost-chain-policy", () => ({
  isPureRepostSourcePost: () => false,
}));

vi.mock("~/lib/hooks/useSignAttemptProgress", () => ({
  useSignAttemptProgress: () => ({
    signAttempt: null,
    signElapsedSeconds: 0,
  }),
  describeSignerPhase: () => "",
  formatAttemptElapsed: () => "0s",
}));

vi.mock("~/lib/nostr-adapter.client", () => ({
  nostrAdapter: {
    signEventWithOneRetry: vi.fn(),
  },
}));

import { postFactory } from "../../../factories";

import { RescheduleScheduledPostModal } from "~/features/posts/scheduling/components/RescheduleScheduledPostModal";
import type { PostData } from "~/features/posts/types";

describe("RescheduleScheduledPostModal", () => {
  const queueType = { id: "queue-1", name: "Primary Queue" };
  const postBase = postFactory.scheduled(new Date("2026-04-12T09:30:00.000Z"), {
    id: "scheduled-1",
    caption: "Launch day post",
    fileUrl: ["https://example.com/media.png"],
    queueTypeId: queueType.id,
  });
  const post: PostData = {
    ...(postBase as Omit<PostData, "signedEvent" | "nostrEvent" | "queueType">),
    scheduledAtUtc:
      postBase.scheduledAtUtc ?? new Date("2026-04-12T09:30:00.000Z"),
    queueType,
    nostrEvent: null,
    signedEvent: {
      id: "event-1",
      pubkey: "pubkey-1",
      sig: "sig-1",
      created_at: 1700000000,
      kind: 1,
      content: "Launch day post",
      tags: [["t", "launch"]],
    },
  };

  it("renders premium hierarchy and advanced actions toggle", () => {
    render(
      <RescheduleScheduledPostModal
        post={post}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        queueTypes={[queueType]}
      />
    );

    expect(screen.getByTestId("reschedule-modal")).toBeInTheDocument();
    expect(screen.getByTestId("reschedule-modal-layout")).toBeInTheDocument();
    expect(screen.getByText("Reschedule post")).toBeInTheDocument();
    expect(screen.getByText("Post identity")).toBeInTheDocument();
    expect(screen.getByText("Quick shortcuts")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirm reschedule" })
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Schedule repost" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("reschedule-advanced-toggle"));
    expect(
      screen.getByRole("button", { name: "Schedule repost" })
    ).toBeInTheDocument();
  });
});
