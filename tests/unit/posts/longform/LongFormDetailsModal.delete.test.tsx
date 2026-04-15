/**
 * @vitest-environment jsdom
 */

import type * as RemixReact from "@remix-run/react";
import { render, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    setQueriesData: vi.fn(),
  }),
}));

const fetcherFormData = new FormData();
fetcherFormData.set("_action", "deleteLongForm");
fetcherFormData.set("postId", "lf-1");

const fetcherState = {
  state: "idle",
  data: {},
  formData: fetcherFormData,
};

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
    useFetcher: () => ({
      state: fetcherState.state,
      data: fetcherState.data,
      formData: fetcherState.formData,
      submit: vi.fn(),
      Form: ({
        children,
        ...props
      }: React.FormHTMLAttributes<HTMLFormElement>) => (
        <form {...props}>{children}</form>
      ),
    }),
    useRouteLoaderData: () => undefined,
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

import LongFormDetailsModal from "~/features/posts/longform/components/LongFormDetailsModal";

describe("LongFormDetailsModal delete behavior", () => {
  it("invokes onDeleted and onClose for deleteLongForm responses without explicit success flag", async () => {
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    const post: React.ComponentProps<typeof LongFormDetailsModal>["post"] = {
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

    render(
      <LongFormDetailsModal
        post={post}
        onClose={onClose}
        onDeleted={onDeleted}
        type="published"
      />
    );

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledWith("lf-1");
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
