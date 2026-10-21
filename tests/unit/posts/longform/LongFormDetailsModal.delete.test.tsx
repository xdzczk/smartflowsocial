/**
 * @vitest-environment jsdom
 */

import type * as RemixReact from "@remix-run/react";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    setQueriesData: vi.fn(),
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
    refetchQueries: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@remix-run/react", async () => {
  const actual = await vi.importActual<typeof RemixReact>("@remix-run/react");
  return {
    ...actual,
    Link: ({
      to,
      children,
      ...props
    }: {
      to: string;
      children: React.ReactNode;
    } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
    useRouteLoaderData: () => undefined,
    // `useOptionalUser()` reads these; the modal is rendered without a data router here.
    useMatches: () => [],
    useNavigation: () => ({ state: "idle", location: undefined }),
  };
});

vi.mock("~/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("~/components/ui/button", () => ({
  Button: ({
    children,
    asChild: _asChild,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("~/components/ui/separator", () => ({
  Separator: () => <hr />,
}));

vi.mock("~/features/posts/components/MarkdownPreview", () => ({
  MarkdownPreview: ({ source }: { source: string }) => <div>{source}</div>,
}));

vi.mock(
  "~/features/posts/components/post-detail-modal/PostDetailHeader",
  () => ({
    PostDetailHeader: ({ subtitle }: { subtitle?: string | null }) => (
      <div>{subtitle ?? ""}</div>
    ),
  })
);

vi.mock(
  "~/features/posts/components/post-detail-modal/rail/DetailModalReplySnippet",
  () => ({
    DetailModalReplySnippet: () => <div>reply</div>,
  })
);

vi.mock("~/features/posts/components/publishing-rail", () => ({
  RailSectionHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  RailSettingsValueRow: ({
    label,
    value,
  }: {
    label: string;
    value: string;
  }) => (
    <div>
      {label}:{value}
    </div>
  ),
  RAIL_MAJOR_DIVIDE: "",
  RAIL_PAD_X: "",
  RAIL_ZONE_PY: "",
  railFieldClassNames: "",
  railSelectTriggerClassNames: "",
}));

vi.mock("~/features/posts/scheduled/components/ScheduledPostActionBar", () => ({
  ScheduledPostActionBar: ({ deleteForm }: { deleteForm: React.ReactNode }) => (
    <div>{deleteForm}</div>
  ),
}));

vi.mock("~/lib/query/hooks/useApiQuery", () => ({
  useThreadView: () => ({
    data: null,
    isPending: false,
  }),
}));

vi.mock("~/lib/hooks/useFormattedDate", () => ({
  useFormattedDate: () => ({ dateLocale: "en-GB" }),
}));

vi.mock("~/lib/nostr-client-urls", () => ({
  getNostrClientUrlsFromUser: () => ({
    eventUrl: (id: string) => `https://nostr.example/event/${id}`,
    articleUrl: (id: string) => `https://nostr.example/article/${id}`,
  }),
}));

const mockFetch = vi.fn().mockResolvedValue(new Response("{}"));
vi.stubGlobal("fetch", mockFetch);

import LongFormDetailsModal from "~/features/posts/longform/components/LongFormDetailsModal";

function makePost(): React.ComponentProps<typeof LongFormDetailsModal>["post"] {
  return {
    id: "lf-1",
    userId: "user-1",
    title: "Longform",
    content: "Body",
    summary: null,
    image: null,
    tags: [],
    status: "DRAFT",
    currentState: "DRAFT",
    queueTypeId: null,
    hashTagPresetId: null,
    createdAt: new Date("2026-04-15T10:00:00.000Z"),
    updatedAt: new Date("2026-04-15T10:00:00.000Z"),
    publishedAt: new Date("2026-04-15T10:00:00.000Z"),
    scheduledAtUtc: null,
    nominalScheduledAtUtc: null,
    postedAt: null,
    creationIdempotencyKey: null,
    enqueueIdempotencyKey: null,
    publishAttemptId: null,
    publishingLockId: null,
    publishingLockExpiresAt: null,
    publishingStartedAt: null,
    queueType: null,
    signedEvent: null,
    nostrEventId: "event-1",
  };
}

describe("LongFormDetailsModal delete behavior", () => {
  it("invokes onDeleted and onClose immediately when delete button is clicked", () => {
    const onClose = vi.fn();
    const onDeleted = vi.fn();

    render(
      <LongFormDetailsModal
        post={makePost()}
        onClose={onClose}
        onDeleted={onDeleted}
        type="published"
      />
    );

    const deleteButton = screen.getByText("Delete Article");
    fireEvent.click(deleteButton);

    expect(onDeleted).toHaveBeenCalledWith("lf-1");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("sends a fetch request to the server when delete button is clicked", () => {
    mockFetch.mockClear();
    const onClose = vi.fn();
    const onDeleted = vi.fn();

    render(
      <LongFormDetailsModal
        post={makePost()}
        onClose={onClose}
        onDeleted={onDeleted}
        type="published"
      />
    );

    const deleteButton = screen.getByText("Delete Article");
    fireEvent.click(deleteButton);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(window.location.pathname);
    expect(url).toContain("_data=");
    expect(options.method).toBe("POST");
    const body = options.body as FormData;
    expect(body.get("_action")).toBe("deleteLongForm");
    expect(body.get("postId")).toBe("lf-1");
  });
});
