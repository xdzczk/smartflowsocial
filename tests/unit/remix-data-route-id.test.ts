import { describe, expect, it } from "vitest";

import { pathnameToRemixDataRouteId } from "~/lib/query/remix-data-route-id";

describe("pathnameToRemixDataRouteId", () => {
  it("maps /dashboard to dashboard index route id", () => {
    expect(pathnameToRemixDataRouteId("/dashboard")).toBe(
      "routes/dashboard._index"
    );
  });

  it("maps queue-filter URLs to dynamic route module ids", () => {
    expect(pathnameToRemixDataRouteId("/dashboard/scheduled/foo")).toBe(
      "routes/dashboard.scheduled.$queueType"
    );
    expect(pathnameToRemixDataRouteId("/dashboard/published/bar")).toBe(
      "routes/dashboard.published.$queueType"
    );
    expect(pathnameToRemixDataRouteId("/dashboard/drafts/baz")).toBe(
      "routes/dashboard.drafts.$queueType"
    );
    expect(pathnameToRemixDataRouteId("/dashboard/recyclables/qux")).toBe(
      "routes/dashboard.recyclables.$queueType"
    );
  });

  it("maps static nested routes with dot notation", () => {
    expect(pathnameToRemixDataRouteId("/dashboard/scheduled")).toBe(
      "routes/dashboard.scheduled"
    );
    expect(pathnameToRemixDataRouteId("/dashboard/engagement/feed")).toBe(
      "routes/dashboard.engagement.feed"
    );
  });
});
