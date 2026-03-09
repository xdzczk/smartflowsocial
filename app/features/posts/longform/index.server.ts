/**
 * Longform submodule: server API.
 * Exports from local longform/ state-machine, services, use-cases.
 */
export { LongFormPostStateMachine } from "./state-machine/longform-post-state-machine.server";
export type {
  LongFormPostState,
  LongFormPostStateTransition,
} from "./state-machine/longform-post-state";
export {
  canTransitionLongFormPost,
  transitionLongFormPost,
  isDraftStateLongForm,
  isScheduledStateLongForm,
  isPublishingStateLongForm,
  isPublishedStateLongForm,
  isFailedStateLongForm,
  isCancelledStateLongForm,
  deriveIsPublishedLongForm,
  deriveIsScheduledLongForm,
  deriveIsDraftLongForm,
  getStatusTextFromStateLongForm,
} from "./state-machine/longform-post-state";
export {
  validateLongFormPostStateConsistency,
  validateAllLongFormPostStates,
  fixLongFormPostStateInconsistencies,
  backfillLongFormPostCurrentState,
} from "./state-machine/longform-post-state-validator.server";
export type { LongFormPostStateInconsistency } from "./state-machine/longform-post-state-validator.server";

export { loadLongFormEditData } from "./services/longform-edit-loader.server";
export { handleLongFormEditAction } from "./services/longform-edit-action.server";
export { loadNewLongFormData } from "./services/newlongform-loader.server";
export { handleNewLongFormAction } from "./services/newlongform-action.server";
export {
  calculateLongFormStatus,
  type LongFormStatus,
  type LongFormStatusCalculation,
} from "./services/longform-status-calculator.server";

export { CreateLongFormPostUseCase } from "./use-cases/create-longform-post.use-case.server";
export { ScheduleLongFormPostUseCase } from "./use-cases/schedule-longform-post.use-case.server";
export { CancelScheduleLongFormUseCase } from "./use-cases/cancel-schedule-longform.use-case.server";
export type { CancelLongFormPostInput } from "./use-cases/cancel-schedule-longform.use-case.server";
export { MoveScheduledLongFormToDraftUseCase } from "./use-cases/move-scheduled-longform-to-draft.use-case.server";
export type { MoveScheduledLongFormToDraftInput } from "./use-cases/move-scheduled-longform-to-draft.use-case.server";
export { PublishLongFormNowUseCase } from "./use-cases/publish-longform-now.use-case.server";
export type {
  CreateLongFormPostInput,
  CreateLongFormPostResult,
  ScheduleLongFormPostInput,
  PublishLongFormNowInput,
} from "./use-cases/longform-types";
