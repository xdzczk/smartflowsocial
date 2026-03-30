import { describe, expect, it } from "vitest";

import {
  getContestLaunchCtaKey,
  contestLaunchActionConfig,
} from "~/features/contest/contest-launch-cta-config";

describe("contestLaunchActionConfig", () => {
  it("maps source × launch mode to spec labels", () => {
    expect(getContestLaunchCtaKey("existing", "now")).toBe("existing_now");
    expect(contestLaunchActionConfig.existing_now.ctaLabel).toBe(
      "Launch contest now"
    );
    expect(getContestLaunchCtaKey("create", "schedule")).toBe("new_schedule");
    expect(contestLaunchActionConfig.new_schedule.ctaLabel).toBe(
      "Schedule post & contest"
    );
  });
});
