import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
  useNavigate,
} from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import { ErrorMessage } from "~/features/posts/components/ErrorMessage";
import PublishResultModal from "~/features/posts/components/PublishResultModal";
import { CreateComposerShell } from "~/features/posts/composer";
import type { ComposerPublishMode } from "~/features/posts/composer/components/composer";
import { DraftPickerModal } from "~/features/posts/drafts";
import { useNewLongFormState } from "~/features/posts/hooks/useNewLongFormState";
import { refreshPostViews } from "~/features/posts/hooks/useRefreshPostViews";
import { RelaySelectorModal } from "~/features/posts/ui";
import {
  getPostTypeFromPost,
  getNewPostUrl,
  determineModalAction,
} from "~/features/posts/utils/publish-result.utils";
import { getActionErrorMessage } from "~/lib/errors";

import LongFormPost from "./LongFormPost";
import LongFormPreviewModal from "./LongFormPreviewModal";
import { parseNewLongFormPostLoader } from "./parse-new-longform-post-loader";

export default function NewLongFormPostPage() {
  const loaderData = useLoaderData<unknown>();
  const actionData = useActionData<unknown>();
  const queryClient = useQueryClient();

  const parsedLoader = useMemo(
    () => parseNewLongFormPostLoader(loaderData),
    [loaderData]
  );

  const {
    userTags,
    scheduleIntervals,
    queueTypes,
    hashTagPresets,
    userTimezone,
    uploadProvider,
    defaultRelays,
    initialTemplateData,
    templatesRaw,
  } = parsedLoader;

  const safeUserTags = typeof userTags === "string" ? userTags : "";

  const {
    displayedHashtags,
    showPreviewModal,
    setShowPreviewModal,
    previewData,
    useHashtagPresets,
    selectedHashtagPresetId,
    selectedHashtags,
    handleHashtagPresetSelect,
    updateDisplayedHashtags,
    handleUseHashtagPresetsChange,
    handlePreview,
  } = useNewLongFormState({ userTags: safeUserTags });

  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const scheduledAt = searchParams.get("scheduledAt");
  const publishResultToken =
    searchParams.get("published") ?? searchParams.get("scheduled");
  const navigate = useNavigate();
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [modalPostId, setModalPostId] = useState<string | null>(null);
  const [modalPost, setModalPost] = useState<{
    id: string;
    publishAttemptId: string | null;
    currentState?: string | null;
    scheduledAtUtc?: string | Date | null;
  } | null>(null);
  const [modalLongFormPost, setModalLongFormPost] = useState<{
    id: string;
    publishAttemptId: string | null;
    currentState?: string | null;
    scheduledAtUtc?: string | Date | null;
  } | null>(null);
  const [publishMode, setPublishMode] = useState<ComposerPublishMode>("now");
  const [longformDraftPicker, setLongformDraftPicker] = useState<{
    open: boolean;
    mode: "drafts" | "templates";
  }>({ open: false, mode: "drafts" });
  const [saveStateLabel, setSaveStateLabel] = useState<string | null>(null);
  const [relaySelectorOpen, setRelaySelectorOpen] = useState(false);
  const [selectedRelayUrls, setSelectedRelayUrls] = useState<string[]>([]);

  const openRelaySelector = useCallback(() => {
    setRelaySelectorOpen(true);
  }, []);

  // Check for published/scheduled URL param
  useEffect(() => {
    const publishedPostId = searchParams.get("published");
    const scheduledPostId = searchParams.get("scheduled");
    const postId = publishedPostId ?? scheduledPostId;

    if (postId && !modalPostId && !showPublishModal) {
      // Use setTimeout to avoid setState in effect warning
      setTimeout(() => {
        setModalPostId(postId);
      }, 0);

      // Fetch post data using fetch directly for API routes
      void (async () => {
        try {
          const res = await fetch(`/api/posts/${postId}`);
          if (!res.ok) {
            throw new Error(`Failed to fetch: ${res.status}`);
          }
          const data = (await res.json()) as {
            post?: {
              id: string;
              publishAttemptId: string | null;
              currentState?: string | null;
              scheduledAtUtc?: string | null;
            };
            longFormPost?: {
              id: string;
              publishAttemptId: string | null;
              currentState?: string | null;
              scheduledAtUtc?: string | null;
            };
            error?: string;
          };

          if (data.post || data.longFormPost) {
            if (publishedPostId || scheduledPostId) {
              refreshPostViews(queryClient);
            }
            setTimeout(() => {
              setModalPost(data.post ?? null);
              setModalLongFormPost(data.longFormPost ?? null);
              setShowPublishModal(true);
            }, 0);
            // Clear URL param to prevent re-showing on refresh
            const newSearchParams = new URLSearchParams(searchParams);
            newSearchParams.delete("published");
            newSearchParams.delete("scheduled");
            setSearchParams(newSearchParams, { replace: true });
          }
        } catch (error) {
          console.error("Failed to fetch post data:", error);
          // Reset state on error
          setTimeout(() => {
            setModalPostId(null);
          }, 0);
        }
      })();
    }
  }, [
    searchParams,
    modalPostId,
    showPublishModal,
    setSearchParams,
    queryClient,
  ]);

  useEffect(() => {
    if (!publishResultToken) return;
    try {
      localStorage.removeItem("longform-draft-new");
    } catch {
      // ignore
    }
  }, [publishResultToken]);

  return (
    <CreateComposerShell
      contentType="article"
      onContentTypeChange={(next) => {
        if (navigation.state !== "idle") return;
        if (next === "article") return;
        navigate(`/dashboard/compose?type=${encodeURIComponent(next)}`);
      }}
      title={initialTemplateData ? "Edit article draft" : "Create article"}
      composerHeaderActions={
        <div className="flex items-center gap-0.5 sm:gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setLongformDraftPicker({ open: true, mode: "drafts" })
            }
            className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
            aria-label="Open drafts"
          >
            Drafts
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setLongformDraftPicker({ open: true, mode: "templates" })
            }
            className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
            aria-label="Open templates"
          >
            Templates
          </Button>
        </div>
      }
      saveStateLabel={saveStateLabel}
    >
      <ErrorMessage
        error={getActionErrorMessage(actionData)}
        success={
          actionData &&
          typeof actionData === "object" &&
          "success" in actionData
            ? ((actionData as { success?: unknown }).success as
                | boolean
                | undefined)
            : undefined
        }
      />

      <Form method="post" encType="multipart/form-data">
        <input type="hidden" name="contentType" value="article" />
        <LongFormPost
          key={`newlongform-composer-${publishResultToken ?? "default"}`}
          publishMode={publishMode}
          onPublishModeChange={setPublishMode}
          initialData={initialTemplateData}
          initialScheduledFor={scheduledAt ?? undefined}
          queueTypes={queueTypes}
          scheduleIntervals={scheduleIntervals}
          userTags={safeUserTags}
          hashTagPresets={hashTagPresets}
          uploadProvider={
            typeof uploadProvider === "string" || uploadProvider === null
              ? uploadProvider
              : null
          }
          userTimezone={
            typeof userTimezone === "string" ? userTimezone : undefined
          }
          onQueueTypeChange={(name) => void updateDisplayedHashtags(name)}
          onPreview={handlePreview}
          useHashtagPresets={useHashtagPresets}
          onUseHashtagPresetsChange={handleUseHashtagPresetsChange}
          selectedHashtagPresetId={selectedHashtagPresetId}
          selectedHashtags={selectedHashtags}
          onHashtagPresetChange={handleHashtagPresetSelect}
          skipLocalDraftRestore={Boolean(publishResultToken)}
          onDraftStateLabelChange={setSaveStateLabel}
          defaultRelays={defaultRelays}
          relayOverride={
            selectedRelayUrls.length > 0 ? selectedRelayUrls : undefined
          }
          onRelayClick={openRelaySelector}
        />
      </Form>

      {relaySelectorOpen ? (
        <RelaySelectorModal
          defaultRelays={defaultRelays}
          selectedRelays={
            selectedRelayUrls.length > 0 ? selectedRelayUrls : defaultRelays
          }
          onClose={() => setRelaySelectorOpen(false)}
          onSave={(urls) => {
            setSelectedRelayUrls(urls);
            setRelaySelectorOpen(false);
          }}
        />
      ) : null}

      <DraftPickerModal
        key={longformDraftPicker.mode}
        open={longformDraftPicker.open}
        onClose={() => setLongformDraftPicker((s) => ({ ...s, open: false }))}
        type="longform"
        onSelect={
          longformDraftPicker.mode === "drafts"
            ? (id) => navigate(`/dashboard/drafts/longform/edit/${id}`)
            : undefined
        }
        draftsAndTemplates={
          longformDraftPicker.mode === "templates"
            ? {
                templates: templatesRaw,
                templatesOnly: true,
                onSelectTemplate: (templateId) =>
                  navigate(
                    `/dashboard/compose?type=article&templateId=${encodeURIComponent(templateId)}`
                  ),
              }
            : undefined
        }
      />

      <LongFormPreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title={previewData.title}
        summary={previewData.summary}
        content={previewData.content}
        image={previewData.image}
        displayedHashtags={displayedHashtags}
      />

      {showPublishModal && modalPostId && (modalPost || modalLongFormPost) ? (
        <PublishResultModal
          isOpen={showPublishModal}
          postId={modalPostId}
          publishAttemptId={
            modalPost?.publishAttemptId ??
            modalLongFormPost?.publishAttemptId ??
            null
          }
          action={determineModalAction(modalPost, modalLongFormPost)}
          postType={getPostTypeFromPost(modalPost, modalLongFormPost)}
          scheduledFor={
            modalPost?.scheduledAtUtc ??
            modalLongFormPost?.scheduledAtUtc ??
            null
          }
          onCreateNew={() => {
            const postType = getPostTypeFromPost(modalPost, modalLongFormPost);
            setShowPublishModal(false);
            setModalPostId(null);
            setModalPost(null);
            setModalLongFormPost(null);
            try {
              localStorage.removeItem("longform-draft-new");
            } catch {
              // ignore
            }
            navigate(getNewPostUrl(postType));
          }}
          onGoToDashboard={() => {
            setShowPublishModal(false);
            setModalPostId(null);
            setModalPost(null);
            setModalLongFormPost(null);
            navigate("/dashboard");
          }}
          onViewPage={() => {
            const postType = getPostTypeFromPost(modalPost, modalLongFormPost);
            const action = determineModalAction(modalPost, modalLongFormPost);

            if (action === "schedule") {
              // Navigate to scheduled page
              if (postType === "longform") {
                navigate("/dashboard/scheduled?tab=longform");
              } else {
                navigate("/dashboard/scheduled");
              }
            } else {
              // Navigate to posted page
              if (postType === "longform") {
                navigate("/dashboard/published?tab=longform");
              } else {
                navigate("/dashboard/published");
              }
            }
          }}
        />
      ) : null}
    </CreateComposerShell>
  );
}
