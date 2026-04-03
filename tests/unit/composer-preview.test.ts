import { describe, expect, it } from "vitest";

import {
  computeHiddenTagsWarning,
  computePollPreviewWarnings,
  computePostPreviewWarnings,
} from "~/features/posts/composer/preview/compute-preview-warnings";
import { normalizePollPreviewFromComposer } from "~/features/posts/composer/preview/normalize-poll-preview";
import { normalizePostPreviewFromComposer } from "~/features/posts/composer/preview/normalize-post-preview";
import { orderAttachmentsForPreview } from "~/features/posts/composer/preview/order-attachments-for-preview";
import { getPollPreviewEndLabel } from "~/features/posts/composer/preview/poll-preview-end-label";
import type { ComposerAttachment } from "~/features/posts/types";

function att(
  localId: string,
  url: string,
  mime = "image/jpeg"
): ComposerAttachment {
  return { localId, status: "done", url, mime };
}

describe("composer preview", () => {
  it("orderAttachmentsForPreview follows composer strip order", () => {
    const content = "Hi\n\n[attach:b]\n\n[attach:a]";
    const attachments = [
      att("a", "https://a.test/x.jpg"),
      att("b", "https://b.test/y.jpg"),
    ];
    const ordered = orderAttachmentsForPreview(content, attachments);
    expect(ordered.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("normalizePostPreviewFromComposer strips tokens and hides tags flag", () => {
    const n = normalizePostPreviewFromComposer({
      content: "Line\n[attach:x]",
      attachments: [att("x", "https://m.test/p.jpg")],
      tagsLine: "foo bar",
      includeHashtagsInNoteBody: false,
    });
    expect(n.text).toBe("Line");
    expect(n.media).toHaveLength(1);
    expect(n.tags).toEqual(["foo", "bar"]);
    expect(n.hideTags).toBe(true);
  });

  it("computePostPreviewWarnings returns no token-based warnings", () => {
    expect(computePostPreviewWarnings({ rawContent: "x [attach:1]" })).toEqual(
      []
    );
    expect(
      computePostPreviewWarnings({
        rawContent: "x [attach:1]",
        attachments: [att("1", "https://x.test/a.jpg")],
      })
    ).toEqual([]);
  });

  it("orderAttachmentsForPreview appends pending uploads after resolved media", () => {
    const ordered = orderAttachmentsForPreview("hi", [
      att("a", "https://a.test/x.jpg"),
      {
        localId: "p",
        status: "uploading",
        mime: "image/png",
        file: new File([], "n.png", { type: "image/png" }),
      },
    ]);
    expect(ordered.map((m) => m.id)).toEqual(["a", "p"]);
    expect(ordered[1]?.phase).toBe("uploading");
  });

  it("computeHiddenTagsWarning when hide on and no tags", () => {
    const w = computeHiddenTagsWarning(true, "");
    expect(w?.id).toBe("hidden-tags-empty");
  });

  it("getPollPreviewEndLabel absolute empty is explicit", () => {
    expect(
      getPollPreviewEndLabel({
        pollEndMode: "absolute",
        endsAtLocal: "",
        pollEndHoursAfterPublish: 24,
        publishMode: "now",
        scheduledFor: "",
        userTimezone: "UTC",
        userTimeFormat: "24h",
      })
    ).toBe("No end date set");
  });

  it("normalizePollPreviewFromComposer trims options in order", () => {
    const n = normalizePollPreviewFromComposer({
      question: " Q ",
      options: [" a ", "", "b"],
      pollType: "singlechoice",
      tagsLine: "",
      includeHashtagsInNoteBody: true,
      end: {
        pollEndMode: "absolute",
        endsAtLocal: "",
        pollEndHoursAfterPublish: 1,
        publishMode: "now",
        scheduledFor: "",
        userTimezone: "UTC",
        userTimeFormat: "24h",
      },
    });
    expect(n.options).toEqual(["a", "b"]);
    expect(n.question).toBe("Q");
    expect(n.hasPollEndDate).toBe(false);
  });

  it("normalizePollPreviewFromComposer sets hasPollEndDate when absolute end is set", () => {
    const n = normalizePollPreviewFromComposer({
      question: "Q",
      options: ["a", "b"],
      pollType: "singlechoice",
      tagsLine: "",
      includeHashtagsInNoteBody: true,
      end: {
        pollEndMode: "absolute",
        endsAtLocal: "2026-06-01T12:00",
        pollEndHoursAfterPublish: 1,
        publishMode: "now",
        scheduledFor: "",
        userTimezone: "UTC",
        userTimeFormat: "24h",
      },
    });
    expect(n.hasPollEndDate).toBe(true);
    expect(n.endLabel).toMatch(/^Ends /);
  });

  it("computePollPreviewWarnings detects duplicate options", () => {
    const n = normalizePollPreviewFromComposer({
      question: "Q",
      options: ["Same", "same", "Other"],
      pollType: "singlechoice",
      tagsLine: "",
      includeHashtagsInNoteBody: true,
      end: {
        pollEndMode: "absolute",
        endsAtLocal: "",
        pollEndHoursAfterPublish: 1,
        publishMode: "now",
        scheduledFor: "",
        userTimezone: "UTC",
        userTimeFormat: "24h",
      },
    });
    const w = computePollPreviewWarnings(n, ["Same", "same", "Other"]);
    expect(w.some((x) => x.id === "poll-dup-options")).toBe(true);
  });
});
