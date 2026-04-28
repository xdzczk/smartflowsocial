/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSetSearchParams = vi.fn();
const mockUnifiedComposerProps = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    refetchQueries: vi.fn(),
    setQueryData: vi.fn(),
    setQueriesData: vi.fn(),
  }),
}));

vi.mock("@remix-run/react", () => ({
  useLoaderData: () => ({
    queueTypes: [
      {
        id: "queue-1",
        name: "Main",
        scheduleType: "INTERVAL",
        scheduleConfig: { intervalHours: 6 },
      },
    ],
    hashTagPresets: [],
    scheduleIntervals: [2, 6],
    relays: [],
    relaysApp: [],
    relaysNip65Profile: [],
    publishRelaySource: "app",
    initialDraft: null,
    initialDraftId: null,
    initialPollRestore: null,
    templates: [],
    composerContext: { mode: "create" },
    hydrationStatus: "ready",
    hydrationError: null,
    initialScheduledFor: null,
    editingMeta: null,
  }),
  useNavigation: () => ({ state: "idle" }),
  useSearchParams: () => [
    new URLSearchParams("type=post&queue=Main"),
    mockSetSearchParams,
  ],
  useNavigate: () => vi.fn(),
}));

vi.mock("~/features/posts/composer/hooks/useNewPostPublishModalEffect", () => ({
  useNewPostPublishModalEffect: vi.fn(),
}));

vi.mock("~/features/posts/composer/hooks/useNewPostState", () => ({
  useNewPostState: () => ({
    selectedHashTagPresetId: null,
    handleQueueTypeChange: vi.fn(),
    handleHashtagPresetSelect: vi.fn(),
  }),
}));

vi.mock("~/components/skeletons/ComposerSkeleton", () => ({
  ComposerSkeleton: () => <div>loading composer</div>,
}));

vi.mock("~/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("~/features/posts/drafts", () => ({
  DraftPickerModal: () => null,
}));

vi.mock("~/features/posts/ui", () => ({
  PublishResultModal: () => null,
  RelaySelectorModal: () => null,
}));

vi.mock("~/features/posts/composer/components/CreateComposerShell", () => ({
  CreateComposerShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("~/features/posts/composer/components/UnifiedComposer", () => ({
  UnifiedComposer: (props: unknown) => {
    mockUnifiedComposerProps(props);
    const typedProps = props as {
      publishMode?: string;
      initialQueueForCreate?: string | null;
      skipLocalDraftRestore?: boolean;
    };
    return (
      <div data-testid="mock-unified-composer">
        {typedProps.publishMode}:{typedProps.initialQueueForCreate}:
        {String(typedProps.skipLocalDraftRestore)}
      </div>
    );
  },
}));

vi.mock("~/features/posts/composer/components/PollComposer", () => ({
  PollComposer: () => <div data-testid="mock-poll-composer">poll</div>,
}));

vi.mock("~/features/posts/composer/utils/composer-analytics.client", () => ({
  trackComposerEvent: vi.fn(),
}));

import NewPostPage from "~/features/posts/composer/components/NewPostPage";

describe("NewPostPage queue prefill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forces queue mode and preserves queue prefill from URL", async () => {
    render(<NewPostPage />);

    const composer = await screen.findByTestId("mock-unified-composer");
    expect(composer).toHaveTextContent("queue:Main:true");

    expect(mockUnifiedComposerProps).toHaveBeenCalledWith(
      expect.objectContaining({
        publishMode: "queue",
        initialQueueForCreate: "Main",
        skipLocalDraftRestore: true,
      })
    );
  });
});
