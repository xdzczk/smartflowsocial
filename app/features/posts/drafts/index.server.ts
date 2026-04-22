/**
 * Drafts submodule: server API.
 * Exports from local services.
 */
export {
  getDraftVersions,
  getDraftVersionById,
  createShortDraftVersion,
  createLongformDraftVersion,
  restoreShortDraftVersion,
  restoreLongformDraftVersion,
  VERSION_LIMIT,
  shortSnapshotSchema,
  longformSnapshotSchema,
  SHORT_SNAPSHOT_SCHEMA_VERSION,
  LONGFORM_SNAPSHOT_SCHEMA_VERSION,
} from "./services/draft-version.server";
export type {
  ShortSnapshot,
  LongformSnapshot,
} from "./services/draft-version.server";
export {
  listBulkDraftGroups,
  getOrCreateDraftGroup,
  deleteDraftGroupPosts,
  createDraftGroupVersion,
  getBulkDraftGroupPosts,
  DRAFT_GROUP_VERSION_LIMIT,
} from "./services/draft-group.server";
export type {
  BulkDraftGroupSummary,
  BulkDraftSnapshotRow,
} from "./services/draft-group.server";
export { loadDraftsData } from "./services/drafts-loader.server";
export { handleDraftsAction } from "./services/drafts-action.server";
export { loadDraftEditData } from "./services/draft-edit-loader.server";
export { handleDraftEditAction } from "./services/draft-edit-action.server";
// Note: `signDraftForScheduling` lives in `./services/draft-sign.client.ts`
// (it signs in the browser via the user's NIP-07/NIP-46 signer) and is
// re-exported from `./index.ts` for client consumers (`useDraftEditState`).
// It is intentionally NOT re-exported from this server barrel.
