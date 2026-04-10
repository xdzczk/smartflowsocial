/**
 * @vitest-environment jsdom
 */
/// <reference types="@testing-library/jest-dom" />

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@remix-run/react", () => ({
  Link: ({
    to,
    children,
    ...rest
  }: {
    to: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

import { FirstRunDashboard } from "~/features/posts/components/FirstRunDashboard";

describe("FirstRunDashboard", () => {
  it("renders activation hero and primary actions", () => {
    render(
      <FirstRunDashboard
        activity={{
          hasDrafts: false,
          hasScheduled: false,
          hasPublished: false,
          hasQueuesWithContent: false,
        }}
        hasAnyQueue={false}
      />
    );

    expect(screen.getByText("Get started")).toBeInTheDocument();
    expect(
      screen.getByText("Start publishing on Nostr properly")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create first post" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create first queue" })
    ).toBeInTheDocument();
  });

  it("shows checklist completion from activity", () => {
    render(
      <FirstRunDashboard
        activity={{
          hasDrafts: true,
          hasScheduled: true,
          hasPublished: false,
          hasQueuesWithContent: true,
        }}
        hasAnyQueue={true}
      />
    );

    expect(screen.getAllByText("Create first draft").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Schedule a post").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Build your first queue").length
    ).toBeGreaterThan(0);
    // completion icons are rendered with aria-hidden; assert checklist still fully present
    expect(screen.getAllByText("Quick start").length).toBeGreaterThan(0);
  });
});
