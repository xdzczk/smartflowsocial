/**
 * @vitest-environment jsdom
 * Unit tests for longform listing format utils: formatDateCell, getReadingTime, getStatusBadge.
 */
/// <reference types="@testing-library/jest-dom" />

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  formatDateCell,
  getReadingTime,
  getStatusBadge,
} from "~/features/posts/longform/utils/longform-listing-format.utils";

describe("longform-listing-format.utils", () => {
  describe("formatDateCell", () => {
    it("returns em dash for undefined", () => {
      expect(formatDateCell(undefined, "UTC", "24h", "en-GB")).toBe("—");
    });

    it("formats unix timestamp (seconds)", () => {
      const result = formatDateCell("1709827200", "UTC", "24h", "en-GB");
      expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
      expect(result).not.toBe("—");
    });

    it("formats ISO date string", () => {
      const result = formatDateCell(
        "2024-03-08T12:00:00.000Z",
        "UTC",
        "24h",
        "en-GB"
      );
      expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });

    it("formats number (unix seconds)", () => {
      const result = formatDateCell(1709827200, "UTC", "24h", "en-GB");
      expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });

    it("formats Date object", () => {
      const result = formatDateCell(
        new Date("2024-03-08T12:00:00.000Z"),
        "UTC",
        "24h",
        "en-GB"
      );
      expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });

    it("uses dateLocale for display", () => {
      const date = new Date("2024-03-08T12:00:00.000Z");
      const enGB = formatDateCell(date, "UTC", "24h", "en-GB");
      const enUS = formatDateCell(date, "UTC", "24h", "en-US");
      expect(enGB).toMatch(/08\/03\/2024|8\/3\/2024/);
      expect(enUS).toMatch(/03\/08\/2024|3\/8\/2024/);
    });
  });

  describe("getReadingTime", () => {
    it("returns '0 min read' for empty or undefined", () => {
      expect(getReadingTime(undefined)).toBe("0 min read");
      expect(getReadingTime("")).toBe("0 min read");
    });

    it("returns '1 min read' for short content", () => {
      expect(getReadingTime("Hello world")).toBe("1 min read");
    });

    it("estimates reading time from word count (200 words ≈ 1 min)", () => {
      const words = Array(200).fill("word").join(" ");
      expect(getReadingTime(words)).toBe("1 min read");
    });

    it("rounds up to next minute for 201+ words", () => {
      const words = Array(201).fill("word").join(" ");
      expect(getReadingTime(words)).toBe("2 min read");
    });

    it("strips markdown before counting words", () => {
      const markdown = "**bold** and _italic_ and [link](url) text here.";
      const result = getReadingTime(markdown);
      expect(result).toBe("1 min read");
    });
  });

  describe("getStatusBadge", () => {
    it("renders Draft badge for type draft", () => {
      const badge = getStatusBadge("draft");
      render(<>{badge}</>);
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });

    it("renders Scheduled badge for type scheduled", () => {
      const badge = getStatusBadge("scheduled");
      render(<>{badge}</>);
      expect(screen.getByText("Scheduled")).toBeInTheDocument();
    });

    it("renders Published badge for type published", () => {
      const badge = getStatusBadge("published");
      render(<>{badge}</>);
      expect(screen.getByText("Published")).toBeInTheDocument();
    });
  });
});
