/**
 * Right rail for template create/edit: blueprint summary and actions (no publish flow).
 */

import { Link } from "@remix-run/react";

import { ActionRail } from "~/components/action-rail/ActionRail";
import { ActionRailActions } from "~/components/action-rail/ActionRailActions";
import { Button } from "~/components/ui/button";
import {
  RailFeedbackBlock,
  RailSectionHeader,
  RailSettingsValueRow,
  RAIL_PAD_X,
  RAIL_ZONE_PY,
} from "~/features/posts/components/publishing-rail";
import { cn } from "~/lib/utils";

export interface TemplateSettingsRailProps {
  /** "post" | "article" for labels */
  variant: "post" | "article";
  typeLabel: string;
  templateName: string;
  lastUpdatedLabel?: string | null;
  /** Key facts shown as label / value rows */
  summaryRows: Array<{ label: string; value: string }>;
  /** Soft notices (template usefulness, not publish validation) */
  warnings: string[];
  cancelHref?: string;
  /** Primary: save blueprint */
  saveLabel: string;
  saveLoading: boolean;
  saveLoadingLabel?: string;
  onSaveTemplate: () => void;
  saveDisabled: boolean;
  /** Open composer with this template (edit flow only) */
  useTemplateHref?: string | null;
  /** Shown when template exists */
  showDelete?: boolean;
  onDeleteTemplate?: () => void;
  deleteDisabled?: boolean;
}

export function TemplateSettingsRail({
  variant: _variant,
  typeLabel,
  templateName,
  lastUpdatedLabel,
  summaryRows,
  warnings,
  cancelHref = "/dashboard/templates",
  saveLabel,
  saveLoading,
  saveLoadingLabel = "Saving…",
  onSaveTemplate,
  saveDisabled,
  useTemplateHref,
  showDelete,
  onDeleteTemplate,
  deleteDisabled,
}: TemplateSettingsRailProps) {
  void _variant;
  const displayName = templateName.trim() || "Untitled template";

  return (
    <ActionRail
      ariaLabel="Template settings"
      className="lg:top-[4.75rem]"
      footer={
        <ActionRailActions
          secondaryButton={
            useTemplateHref ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 w-full rounded-none border-0 text-xs font-medium"
                asChild
              >
                <Link to={useTemplateHref}>Use template</Link>
              </Button>
            ) : null
          }
          primaryLabel={saveLabel}
          onPrimaryClick={onSaveTemplate}
          primaryDisabled={saveDisabled}
          primaryLoading={saveLoading}
          primaryLoadingLabel={saveLoadingLabel}
        />
      }
    >
      <div className={cn(RAIL_PAD_X, RAIL_ZONE_PY, "space-y-4")}>
        <div>
          <RailSectionHeader>Template</RailSectionHeader>
          <p className="text-text-secondary mt-1 text-xs leading-relaxed">
            Reusable blueprint — not a live post. Publishing happens when you
            use this template in the composer.
          </p>
          <div className="mt-3 space-y-2">
            <RailSettingsValueRow
              label="Type"
              value={typeLabel}
              trailing={null}
            />
            <RailSettingsValueRow
              label="Name"
              value={displayName}
              trailing={null}
            />
            {lastUpdatedLabel ? (
              <RailSettingsValueRow
                label="Updated"
                value={lastUpdatedLabel}
                trailing={null}
              />
            ) : null}
          </div>
          <Button
            variant="link"
            className="text-text-secondary mt-2 h-auto px-0 py-0 text-xs"
            asChild
          >
            <Link to={cancelHref}>Back to Templates</Link>
          </Button>
        </div>

        <div className="border-border border-t pt-2">
          <RailSectionHeader>Included content</RailSectionHeader>
          <div className="mt-2 space-y-2">
            {summaryRows.map((row) => (
              <RailSettingsValueRow
                key={row.label}
                label={row.label}
                value={row.value}
                trailing={null}
              />
            ))}
          </div>
        </div>

        {warnings.length > 0 ? (
          <RailFeedbackBlock
            variant="warning"
            title="Template notes"
            lines={warnings}
          />
        ) : null}

        {showDelete && onDeleteTemplate ? (
          <div className="border-border border-t pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-danger hover:text-danger h-8 px-2"
              onClick={onDeleteTemplate}
              disabled={deleteDisabled}
            >
              Delete template
            </Button>
          </div>
        ) : null}
      </div>
    </ActionRail>
  );
}
