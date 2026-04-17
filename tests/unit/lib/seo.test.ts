import { describe, expect, it } from "vitest";

import {
  buildRootDefaultMeta,
  buildSeoMeta,
  pageTitle,
  siteOriginFromMatches,
} from "~/lib/seo";
import {
  DASHBOARD_SEO_SEGMENT,
  NOINDEX,
  resolveDashboardPageLabel,
  settingsTabToPageTitle,
} from "~/lib/seo-dashboard-routes";

describe("seo", () => {
  const readStringField = (value: unknown, key: string): string | undefined => {
    if (!value || typeof value !== "object") return undefined;
    const record = value as Record<string, unknown>;
    return typeof record[key] === "string" ? record[key] : undefined;
  };

  it("builds page titles with fallback", () => {
    expect(pageTitle("  Dashboard ")).toContain("Dashboard");
    expect(pageTitle("")).toContain("SmartFlowSocial");
  });

  it("builds indexable seo meta with canonical and social tags", () => {
    const meta = buildSeoMeta(
      {
        page: "Plans",
        description: "Compare plans",
        canonicalPath: "plans",
        includeAuthor: true,
      },
      { siteOrigin: "https://smartflow.social" }
    );
    expect(
      meta.some(
        (m) =>
          readStringField(m, "name") === "author" &&
          readStringField(m, "content") === "SmartFlowSocial"
      )
    ).toBe(true);
    expect(
      meta.some(
        (m) =>
          readStringField(m, "rel") === "canonical" &&
          readStringField(m, "href") === "https://smartflow.social/plans"
      )
    ).toBe(true);
    expect(
      meta.some((m) => readStringField(m, "property") === "og:image")
    ).toBe(true);
  });

  it("builds noindex seo meta without social/canonical blocks", () => {
    const meta = buildSeoMeta(
      {
        title: "Private",
        robots: "noindex, nofollow",
        canonicalPath: "/private",
        includeAuthor: true,
      },
      { siteOrigin: "https://smartflow.social" }
    );
    expect(
      meta.some(
        (m) =>
          readStringField(m, "name") === "robots" &&
          readStringField(m, "content") === "noindex, nofollow"
      )
    ).toBe(true);
    expect(
      meta.some((m) => readStringField(m, "property") === "og:title")
    ).toBe(false);
    expect(meta.some((m) => readStringField(m, "rel") === "canonical")).toBe(
      false
    );
  });

  it("supports absolute image urls and root defaults", () => {
    const meta = buildSeoMeta(
      {
        page: "Article",
        imageUrl: "https://cdn.example/hero.png",
      },
      { siteOrigin: "https://smartflow.social" }
    );
    expect(
      meta.some(
        (m) =>
          readStringField(m, "property") === "og:image" &&
          readStringField(m, "content") === "https://cdn.example/hero.png"
      )
    ).toBe(true);
    expect(
      buildRootDefaultMeta("https://smartflow.social").length
    ).toBeGreaterThan(0);
  });

  it("reads siteOrigin from root matches with localhost fallback", () => {
    expect(
      siteOriginFromMatches([
        { id: "root", data: { siteOrigin: "https://smartflow.social" } },
      ])
    ).toBe("https://smartflow.social");
    expect(siteOriginFromMatches([{ id: "other", data: {} }])).toBe(
      "http://localhost"
    );
  });
});

describe("seo dashboard routes", () => {
  it("maps settings tabs to page titles", () => {
    expect(settingsTabToPageTitle("general")).toBe("General Settings");
    expect(settingsTabToPageTitle("media")).toBe("Media & Storage");
    expect(settingsTabToPageTitle(null)).toBe("Settings");
  });

  it("resolves labels for special dynamic routes", () => {
    expect(
      resolveDashboardPageLabel({
        leafId: "routes/dashboard.settings",
        search: "?tab=accounts",
        leafData: null,
      })
    ).toBe("Accounts");
    expect(
      resolveDashboardPageLabel({
        leafId: "routes/dashboard.broadcasts.$id",
        search: "",
        leafData: { campaign: { name: "  Campaign A  " } },
      })
    ).toBe("Campaign A");
    expect(
      resolveDashboardPageLabel({
        leafId: "routes/dashboard.contests.detail.$id",
        search: "",
        leafData: { contest: { title: "Contest One" } },
      })
    ).toBe("Contest One");
    expect(
      resolveDashboardPageLabel({
        leafId: "routes/dashboard.giveaway.detail.$id",
        search: "",
        leafData: { giveaway: { name: "" } },
      })
    ).toBe("Giveaway");
  });

  it("uses static segment map and fallback", () => {
    expect(DASHBOARD_SEO_SEGMENT["routes/dashboard._index"]?.page).toBe(
      "Dashboard"
    );
    expect(
      resolveDashboardPageLabel({
        leafId: "routes/dashboard.published",
        search: "",
        leafData: null,
      })
    ).toBe("Published");
    expect(
      resolveDashboardPageLabel({
        leafId: "routes/unknown",
        search: "",
        leafData: null,
      })
    ).toBe("Dashboard");
    expect(NOINDEX).toBe("noindex, nofollow");
  });
});
