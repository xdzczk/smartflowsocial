import { describe, expect, it } from "vitest";

import {
  buildBulkComposerFollowUpLine,
  buildFollowUpCollapsedSummary,
  countRepostConditionRules,
} from "~/features/posts/components/follow-up";
import type { RepostConditions } from "~/features/posts/types";

describe("follow-up summary helpers", () => {
  it("countRepostConditionRules counts set thresholds only", () => {
    expect(countRepostConditionRules(null)).toBe(0);
    expect(countRepostConditionRules({})).toBe(0);
    const c: RepostConditions = {
      minReactions: 5,
      minReposts: 1,
      minSats: 100,
    };
    expect(countRepostConditionRules(c)).toBe(3);
  });

  it("buildFollowUpCollapsedSummary", () => {
    expect(
      buildFollowUpCollapsedSummary({
        repostCount: 0,
        quoteCount: 0,
        conditionRuleCount: 0,
      })
    ).toBe("None");

    expect(
      buildFollowUpCollapsedSummary({
        repostCount: 2,
        quoteCount: 0,
        conditionRuleCount: 0,
      })
    ).toBe("Repost (2)");

    expect(
      buildFollowUpCollapsedSummary({
        repostCount: 1,
        quoteCount: 0,
        conditionRuleCount: 2,
      })
    ).toBe("Repost (1) · Conditions");

    expect(
      buildFollowUpCollapsedSummary({
        repostCount: 0,
        quoteCount: 3,
        conditionRuleCount: 0,
      })
    ).toBe("Quote (3)");

    expect(
      buildFollowUpCollapsedSummary({
        repostCount: 1,
        quoteCount: 2,
        conditionRuleCount: 1,
      })
    ).toBe("Repost (1) · Conditions · Quote (2)");
  });

  it("buildBulkComposerFollowUpLine", () => {
    expect(
      buildBulkComposerFollowUpLine({
        repostScheduleCount: 0,
        quoteScheduleCount: 0,
        showBatchRepostConditions: false,
        batchHasRepostConditionRules: false,
      })
    ).toBe("None");

    expect(
      buildBulkComposerFollowUpLine({
        repostScheduleCount: 1,
        quoteScheduleCount: 0,
        showBatchRepostConditions: true,
        batchHasRepostConditionRules: true,
      })
    ).toBe("Override active (Repost)");

    expect(
      buildBulkComposerFollowUpLine({
        repostScheduleCount: 0,
        quoteScheduleCount: 2,
        showBatchRepostConditions: true,
        batchHasRepostConditionRules: false,
      })
    ).toBe("Override active (Quote)");

    expect(
      buildBulkComposerFollowUpLine({
        repostScheduleCount: 1,
        quoteScheduleCount: 1,
        showBatchRepostConditions: false,
        batchHasRepostConditionRules: false,
      })
    ).toBe("Override active (Repost + Quote)");

    expect(
      buildBulkComposerFollowUpLine({
        repostScheduleCount: 0,
        quoteScheduleCount: 0,
        showBatchRepostConditions: true,
        batchHasRepostConditionRules: true,
      })
    ).toBe("Inherits batch follow-up");
  });
});
