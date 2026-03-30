import { TemplateSettingsRail } from "~/features/templates/components/TemplateSettingsRail";

export function UnifiedComposerTemplateSettingsRail(props: {
  isThreadMode: boolean;
  templateName: string;
  templateLastUpdatedLabel: string | null | undefined;
  threadSegmentsLength: number;
  threadCharCount: number;
  threadMediaCount: number;
  repostDelayListLength: number;
  quoteEntriesLength: number;
  contentLength: number;
  attachmentsLength: number;
  isRecyclableVal: boolean;
  templateRailWarnings: string[];
  primaryActionLoading: boolean;
  primarySubmitDisabled: boolean;
  editTemplateContext:
    | { templateId: string; postId: string }
    | null
    | undefined;
  onSaveTemplate: () => void;
  onTemplateDeleteClick?: (() => void) | null;
  disabled: boolean;
}) {
  const {
    isThreadMode,
    templateName,
    templateLastUpdatedLabel,
    threadSegmentsLength,
    threadCharCount,
    threadMediaCount,
    repostDelayListLength,
    quoteEntriesLength,
    contentLength,
    attachmentsLength,
    isRecyclableVal,
    templateRailWarnings,
    primaryActionLoading,
    primarySubmitDisabled,
    editTemplateContext,
    onSaveTemplate,
    onTemplateDeleteClick,
    disabled,
  } = props;

  return (
    <TemplateSettingsRail
      variant="post"
      typeLabel={isThreadMode ? "Thread" : "Short post"}
      templateName={templateName}
      lastUpdatedLabel={templateLastUpdatedLabel ?? undefined}
      summaryRows={
        isThreadMode
          ? [
              { label: "Segments", value: String(threadSegmentsLength) },
              { label: "Characters", value: String(threadCharCount) },
              { label: "Media", value: String(threadMediaCount) },
              ...(repostDelayListLength > 0
                ? [
                    {
                      label: "Follow-up reposts",
                      value: String(repostDelayListLength),
                    },
                  ]
                : []),
              ...(quoteEntriesLength > 0
                ? [{ label: "Quotes", value: String(quoteEntriesLength) }]
                : []),
            ]
          : [
              { label: "Characters", value: String(contentLength) },
              { label: "Media", value: String(attachmentsLength) },
              ...(repostDelayListLength > 0
                ? [
                    {
                      label: "Follow-up reposts",
                      value: String(repostDelayListLength),
                    },
                  ]
                : []),
              ...(quoteEntriesLength > 0
                ? [{ label: "Quotes", value: String(quoteEntriesLength) }]
                : []),
              ...(isRecyclableVal
                ? [{ label: "Recyclable", value: "Yes" }]
                : []),
            ]
      }
      warnings={templateRailWarnings}
      saveLabel="Save template"
      saveLoading={primaryActionLoading}
      saveLoadingLabel="Saving…"
      onSaveTemplate={onSaveTemplate}
      saveDisabled={primarySubmitDisabled}
      useTemplateHref={
        editTemplateContext?.templateId
          ? `/dashboard/compose?type=${isThreadMode ? "thread" : "post"}&templateId=${encodeURIComponent(editTemplateContext.templateId)}`
          : null
      }
      showDelete={Boolean(onTemplateDeleteClick)}
      onDeleteTemplate={onTemplateDeleteClick ?? undefined}
      deleteDisabled={disabled}
    />
  );
}
