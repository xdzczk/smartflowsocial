export {
  adminCardTypeToShared,
  type AdminProofCardType,
  type ProofCardBranding,
  type ProofCardFooter,
  type ProofCardPayload,
  type ProofCardType,
  type ProofDisplayOptions,
  type ProofDomain,
  type ProofRatio,
  type ProofStatusTone,
} from "./types";
export { buildProofCaption } from "./build-proof-caption";
export { buildProofSummary } from "./build-proof-summary";
export {
  exportProofCardPng,
  measureProofCardRoot,
  proofExportFilename,
  resolveProofExportScale,
  resolveProofPngBackground,
} from "./export-proof-card";
export {
  PROOF_EXPORT_PIXEL_RATIO,
  PROOF_EXPORT_PX,
  PROOF_RATIO_PREVIEW,
  proofPreviewExportFallbackPx,
  proofRatioLabel,
} from "./ratios";
export {
  proofCardAspectOuterClass,
  proofCardInnerPadClass,
  proofCardShellSurfaceClass,
  proofEyebrowClass,
  proofFooterTextClass,
  proofHeroClass,
  proofSubClass,
  statusBadgeClass,
} from "./themes";
