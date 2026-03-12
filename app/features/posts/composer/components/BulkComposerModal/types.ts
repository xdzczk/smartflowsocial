/**
 * Public types for BulkComposerModal (props and user shape).
 */

import type { BulkPost, QueueType } from "~/features/posts/server";

import type {
  BulkComposerMode,
  BulkComposerUser,
} from "../../utils/bulk-composer-modal.utils";

export type { BulkComposerMode, BulkComposerUser };

export interface BulkComposerModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after successful schedule (e.g. clear selection). */
  onSuccess?: () => void;
  mode: BulkComposerMode;
  initialPosts: BulkPost[];
  user: BulkComposerUser | null;
  /** Pre-loaded context; if not provided, modal will load from /dashboard/bulkposts */
  queueTypes?: QueueType[];
  hashTagPresets?: Array<{ id: string; name: string; tags: string }>;
  tags?: string[];
}
