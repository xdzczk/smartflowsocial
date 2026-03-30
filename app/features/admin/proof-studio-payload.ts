import {
  adminCardTypeToShared,
  type ProofCardPayload,
  type ProofRatio,
} from "~/lib/proof";

import {
  buildProofCardLines,
  type ProofCardLines,
} from "./components/proof-card-build";
import type {
  ProofCardData,
  ProofCardScope,
  ProofCardType as LegacyAdminProofType,
} from "./proof-card-types";

function linesToPayload(
  lines: ProofCardLines,
  cardType: ProofCardPayload["cardType"],
  ratio: ProofRatio,
  scope: ProofCardScope
): ProofCardPayload {
  const [a, b, c] = lines.footerLines;
  return {
    domain: "admin",
    cardType,
    ratio,
    metricFirst: true,
    title: "",
    eyebrow: lines.eyebrow,
    heroValue: lines.headline,
    heroLabel: lines.headlineSub,
    stats: lines.support.map((s) => ({
      label: s.label,
      value: s.value,
      emphasis: s.emphasis,
    })),
    footer: {
      productLabel: a,
      snapshotLabel: b,
      timeRangeLabel: c,
    },
    branding: { showLogo: false, showDomainLabel: false },
    adminScope: scope,
  };
}

export function buildAdminProofPayload(
  scope: ProofCardScope,
  legacyType: LegacyAdminProofType,
  ratio: ProofRatio,
  data: ProofCardData,
  formatSnapshot: (iso: string) => string,
  numberLocale?: string
): ProofCardPayload {
  const lines = buildProofCardLines({
    scope,
    type: legacyType,
    data,
    formatSnapshot,
    numberLocale,
  });
  return linesToPayload(lines, adminCardTypeToShared(legacyType), ratio, scope);
}
