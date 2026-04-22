/**
 * Posts drafts submodule — server API.
 * Import from ~/features/posts/server/drafts for drafts server logic.
 */
export {
  loadDraftsData,
  handleDraftsAction,
  loadDraftEditData,
  handleDraftEditAction,
  createShortDraftVersion,
  SHORT_SNAPSHOT_SCHEMA_VERSION,
  createLongformDraftVersion,
  LONGFORM_SNAPSHOT_SCHEMA_VERSION,
  getDraftVersions,
  getDraftVersionById,
  listBulkDraftGroups,
  getOrCreateDraftGroup,
  deleteDraftGroupPosts,
  createDraftGroupVersion,
  getBulkDraftGroupPosts,
  restoreLongformDraftVersion,
} from "../drafts/index.server";
export type { BulkDraftSnapshotRow } from "../drafts/index.server";
