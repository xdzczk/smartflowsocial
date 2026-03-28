/**
 * Posts composer submodule — server API.
 * Import from ~/features/posts/server/composer for new-post/composer server logic.
 */
export {
  loadNewPostData,
  handleNewPostAction,
  CreatePostUseCase,
  effectiveAppendHashtagsToNoteBody,
  parseIncludeHashtagsInNoteBodyFromForm,
} from "../composer/index.server";
