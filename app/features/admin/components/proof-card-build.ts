import type {
  ProofCardData,
  ProofCardScope,
  ProofCardType,
} from "../proof-card-types";

export interface ProofSupportLine {
  label: string;
  value: string;
  emphasis?: boolean;
}

export interface ProofCardLines {
  /** Card eyebrow / template label */
  eyebrow: string;
  headline: string;
  headlineSub: string;
  support: ProofSupportLine[];
  /** Lines for footer + clipboard (same source as UI) */
  footerLines: string[];
}

const BRAND = "SmartFlow Social";
const BETA = "Public beta";

const LABEL_PUBLISH_SUCCESS_30D = "Publish success (30d)";
const LABEL_LONG_FORM_ALL_TIME = "Long-form (all time)";
const LABEL_LONG_FORM_RANGE = "Long-form (range)";
const LABEL_CREATORS_ALL_TIME = "Creators (all time)";
const LABEL_REFERRAL_SATS_ALL_TIME = "Referral sats paid (all time)";
const SCOPE_ALL_TIME = "all-time" as const satisfies ProofCardScope;
const SCOPE_SELECTED_RANGE = "selected-range" as const satisfies ProofCardScope;
const SCOPE_HYBRID = "hybrid" as const satisfies ProofCardScope;
const SCOPES_SHOWING_RANGE_IN_FOOTER: ProofCardScope[] = [
  SCOPE_SELECTED_RANGE,
  SCOPE_HYBRID,
];
const HEADLINE_SUB_SHORT_POSTS_ALL_TIME = "Short posts published (all time)";
const EYEBROW_RANGE_PERFORMANCE = "Range performance";

function formatSnapshot(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso.slice(0, 16);
  }
}

function addSupport(out: ProofSupportLine[], item: ProofSupportLine, max = 4) {
  if (out.length >= max) return;
  out.push(item);
}

function lowVolumeRange(data: ProofCardData): boolean {
  return data.inRange.postsPublished + data.inRange.longFormPublished < 2;
}

function buildFooter(
  scope: ProofCardScope,
  data: ProofCardData,
  snapshotLabel: (iso: string) => string
): string[] {
  const lines = [
    `${BETA} · ${BRAND}`,
    `Snapshot · ${snapshotLabel(data.generatedAt)}`,
  ];
  if (SCOPES_SHOWING_RANGE_IN_FOOTER.includes(scope)) {
    lines.push(`Dashboard range · ${data.rangeLabel}`);
  }
  return lines;
}

export interface BuildProofCardLinesInput {
  scope: ProofCardScope;
  type: ProofCardType;
  data: ProofCardData;
  /** When set, snapshot footer uses account date/time prefs (from `useFormattedDate`). */
  formatSnapshot?: (iso: string) => string;
  /** BCP 47 locale for integer grouping (e.g. from `useFormattedDate().dateLocale`). */
  numberLocale?: string;
}

/**
 * Curates headline, support metrics, and footer for the share card.
 * Omits weak lines (e.g. zero referral sats on hybrid) unless framed for milestone all-time.
 */
export function buildProofCardLines(
  input: BuildProofCardLinesInput
): ProofCardLines {
  const { scope, type, data } = input;
  const { allTime, inRange, last30d, reliability30d } = data;
  const snapshotLabel = input.formatSnapshot ?? formatSnapshot;
  const fmtNum = (v: number): string =>
    input.numberLocale != null && input.numberLocale !== ""
      ? v.toLocaleString(input.numberLocale)
      : v.toLocaleString();
  const footerLines = buildFooter(scope, data, snapshotLabel);

  if (type === "reliability") {
    return {
      eyebrow: "Publishing reliability",
      headline: `${last30d.publishSuccessRate}%`,
      headlineSub: "Short post publish success (last 30 days)",
      support: [
        {
          label: "Successful short publishes (30d)",
          value: fmtNum(last30d.successfulShortPublishes),
        },
        {
          label: "Failed short publishes (30d)",
          value: fmtNum(last30d.failedShortPublishes),
          emphasis: last30d.failedShortPublishes > 0,
        },
        {
          label: "Failed referral payouts (30d)",
          value: fmtNum(reliability30d.failedReferralPayouts),
          emphasis: reliability30d.failedReferralPayouts > 0,
        },
      ],
      footerLines,
    };
  }

  if (type === "adoption") {
    const rangeNote =
      scope === SCOPE_ALL_TIME
        ? `Dashboard range (${data.rangeLabel})`
        : data.rangeLabel;
    const support: ProofSupportLine[] = [];
    addSupport(support, {
      label: "Scheduled reposts",
      value: fmtNum(inRange.scheduledReposts),
    });
    addSupport(support, {
      label: "Giveaways (locked/paid)",
      value: fmtNum(inRange.giveawaysLockedOrPaid),
    });
    addSupport(support, {
      label: "Active publishers",
      value: fmtNum(inRange.publishersInRange),
    });
    if (inRange.postsPublished > 0) {
      addSupport(support, {
        label: "Short posts published",
        value: fmtNum(inRange.postsPublished),
      });
    }
    return {
      eyebrow: "Feature adoption",
      headline: fmtNum(inRange.postsWithMedia),
      headlineSub: `Posts with media · ${rangeNote}`,
      support,
      footerLines,
    };
  }

  if (type === "product_progress") {
    const support: ProofSupportLine[] = [];
    addSupport(support, {
      label: LABEL_PUBLISH_SUCCESS_30D,
      value: `${last30d.publishSuccessRate}%`,
    });
    addSupport(support, {
      label: "Scheduled posts",
      value: fmtNum(allTime.postsScheduled),
    });
    addSupport(support, {
      label: "Creators who've published",
      value: fmtNum(allTime.creatorsEverPublished),
    });
    addSupport(support, {
      label: LABEL_LONG_FORM_ALL_TIME,
      value: fmtNum(allTime.longFormPublished),
    });
    return {
      eyebrow: "Building in public",
      headline: fmtNum(allTime.postsPublished),
      headlineSub: HEADLINE_SUB_SHORT_POSTS_ALL_TIME,
      support,
      footerLines,
    };
  }

  if (type === "range_performance") {
    const support: ProofSupportLine[] = [];

    if (lowVolumeRange(data) && scope !== SCOPE_ALL_TIME) {
      return {
        eyebrow: EYEBROW_RANGE_PERFORMANCE,
        headline: "Light activity",
        headlineSub: `Few publishes in ${data.rangeLabel} — honest read, not hype.`,
        support: [
          {
            label: "Short posts (range)",
            value: fmtNum(inRange.postsPublished),
          },
          {
            label: LABEL_LONG_FORM_RANGE,
            value: fmtNum(inRange.longFormPublished),
          },
        ],
        footerLines,
      };
    }

    if (scope === SCOPE_ALL_TIME) {
      addSupport(support, {
        label: LABEL_LONG_FORM_ALL_TIME,
        value: fmtNum(allTime.longFormPublished),
      });
      addSupport(support, {
        label: LABEL_CREATORS_ALL_TIME,
        value: fmtNum(allTime.creatorsEverPublished),
      });
      addSupport(support, {
        label: LABEL_PUBLISH_SUCCESS_30D,
        value: `${last30d.publishSuccessRate}%`,
      });
      if (allTime.referralSatsPaid > 0) {
        addSupport(support, {
          label: LABEL_REFERRAL_SATS_ALL_TIME,
          value: fmtNum(allTime.referralSatsPaid),
        });
      }
      return {
        eyebrow: EYEBROW_RANGE_PERFORMANCE,
        headline: fmtNum(allTime.postsPublished),
        headlineSub: HEADLINE_SUB_SHORT_POSTS_ALL_TIME,
        support,
        footerLines,
      };
    }

    addSupport(support, {
      label: LABEL_LONG_FORM_RANGE,
      value: fmtNum(inRange.longFormPublished),
    });
    addSupport(support, {
      label: "Publishers (range)",
      value: fmtNum(inRange.publishersInRange),
    });
    if (inRange.referredSignups > 0 || scope === SCOPE_SELECTED_RANGE) {
      addSupport(support, {
        label: "Referred signups (range)",
        value: fmtNum(inRange.referredSignups),
      });
    }
    addSupport(support, {
      label: "Posts with media (range)",
      value: fmtNum(inRange.postsWithMedia),
    });
    if (allTime.referralSatsPaid > 0) {
      addSupport(support, {
        label: LABEL_REFERRAL_SATS_ALL_TIME,
        value: fmtNum(allTime.referralSatsPaid),
      });
    }

    return {
      eyebrow: EYEBROW_RANGE_PERFORMANCE,
      headline: fmtNum(inRange.postsPublished),
      headlineSub: `Short posts published in ${data.rangeLabel}`,
      support,
      footerLines,
    };
  }

  // milestone
  const support: ProofSupportLine[] = [];

  if (scope === SCOPE_SELECTED_RANGE) {
    addSupport(support, {
      label: LABEL_LONG_FORM_RANGE,
      value: fmtNum(inRange.longFormPublished),
    });
    addSupport(support, {
      label: "Publishers (range)",
      value: fmtNum(inRange.publishersInRange),
    });
    if (inRange.referredSignups > 0) {
      addSupport(support, {
        label: "Referred signups",
        value: fmtNum(inRange.referredSignups),
      });
    }
    addSupport(support, {
      label: LABEL_PUBLISH_SUCCESS_30D,
      value: `${last30d.publishSuccessRate}%`,
    });
    return {
      eyebrow: BRAND,
      headline: fmtNum(inRange.postsPublished),
      headlineSub: `Short posts published in ${data.rangeLabel}`,
      support,
      footerLines,
    };
  }

  if (scope === SCOPE_ALL_TIME) {
    addSupport(support, {
      label: "Long-form published",
      value: fmtNum(allTime.longFormPublished),
    });
    addSupport(support, {
      label: "Creators who've published",
      value: fmtNum(allTime.creatorsEverPublished),
    });
    addSupport(support, {
      label: LABEL_PUBLISH_SUCCESS_30D,
      value: `${last30d.publishSuccessRate}%`,
    });
    addSupport(support, {
      label: "Scheduled posts",
      value: fmtNum(allTime.postsScheduled),
    });
    if (allTime.referralSatsPaid > 0) {
      addSupport(support, {
        label: "Referral sats paid",
        value: fmtNum(allTime.referralSatsPaid),
      });
    } else {
      addSupport(support, {
        label: "Referral sats (to date)",
        value: "0 — program live",
      });
    }
    return {
      eyebrow: BRAND,
      headline: fmtNum(allTime.postsPublished),
      headlineSub: "Short posts published through the platform (all time)",
      support,
      footerLines,
    };
  }

  // hybrid + milestone (allow 5th line when referral payouts exist)
  const hybridCap = allTime.referralSatsPaid > 0 ? 5 : 4;
  addSupport(
    support,
    {
      label: `In ${data.rangeLabel}`,
      value: `${fmtNum(inRange.postsPublished)} posts`,
    },
    hybridCap
  );
  addSupport(
    support,
    {
      label: LABEL_CREATORS_ALL_TIME,
      value: fmtNum(allTime.creatorsEverPublished),
    },
    hybridCap
  );
  addSupport(
    support,
    {
      label: LABEL_PUBLISH_SUCCESS_30D,
      value: `${last30d.publishSuccessRate}%`,
    },
    hybridCap
  );
  addSupport(
    support,
    {
      label: LABEL_LONG_FORM_ALL_TIME,
      value: fmtNum(allTime.longFormPublished),
    },
    hybridCap
  );
  if (allTime.referralSatsPaid > 0) {
    addSupport(
      support,
      {
        label: "Referral sats paid",
        value: fmtNum(allTime.referralSatsPaid),
      },
      hybridCap
    );
  }

  return {
    eyebrow: BRAND,
    headline: fmtNum(allTime.postsPublished),
    headlineSub: HEADLINE_SUB_SHORT_POSTS_ALL_TIME,
    support,
    footerLines,
  };
}

export function proofCardSummaryText(lines: ProofCardLines): string {
  return [
    lines.eyebrow,
    `${lines.headline} — ${lines.headlineSub}`,
    ...lines.support.map((s) => `${s.label}: ${s.value}`),
    ...lines.footerLines,
  ].join("\n");
}
