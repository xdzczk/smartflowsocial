import { useFetcher } from "@remix-run/react";
import { Plus, Edit2, Trash2, Hash } from "lucide-react";
import { useMemo, useState, useEffect } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { ManagementListSection } from "~/features/settings/components/patterns";
import type { QueueTypeSettings } from "~/features/settings/components/settings-page-loader-parsers";
import { normalizeHashtagPresetTags } from "~/lib/hashtag-preset-normalize";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import {
  createHashtagPresetClientSchema,
  updateHashtagPresetClientSchema,
} from "~/lib/validation";
import {
  useZodForm,
  formDataToFormData,
} from "~/lib/validation/utils.client-safe";

const MAX_TAG_CHIPS_VISIBLE = 4;

interface HashTagPreset {
  id: string;
  name: string;
  tags: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface HashtagPresetsSettingsProps {
  queueTypes: QueueTypeSettings[];
  presets: HashTagPreset[];
}

interface FetcherData {
  success?: boolean;
  error?: string;
}

function parseTagList(tags: string): string[] {
  return tags
    .split(/\s+/)
    .filter((tag) => tag.startsWith("#") && tag.length > 1);
}

function countLinkedQueues(
  queueTypes: QueueTypeSettings[],
  presetId: string
): number {
  return queueTypes.filter((q) => q.hashTagPresetId === presetId).length;
}

export function HashtagPresetsSettings({
  queueTypes,
  presets,
}: HashtagPresetsSettingsProps) {
  const fetcher = useFetcher<FetcherData>();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<HashTagPreset | null>(
    null
  );
  const [presetPendingDelete, setPresetPendingDelete] =
    useState<HashTagPreset | null>(null);

  const createForm = useZodForm(createHashtagPresetClientSchema, {
    defaultValues: {
      name: "",
      tags: "",
      description: "",
    },
  });

  const editForm = useZodForm(updateHashtagPresetClientSchema, {
    defaultValues: {
      id: "",
      name: "",
      tags: "",
      description: "",
    },
  });

  const isSubmitting = fetcher.state === "submitting";

  const createTagsWatch = createForm.watch("tags");
  const editTagsWatch = editForm.watch("tags");

  const createPreviewTags = useMemo(
    () => parseTagList(normalizeHashtagPresetTags(createTagsWatch)),
    [createTagsWatch]
  );
  const editPreviewTags = useMemo(
    () => parseTagList(normalizeHashtagPresetTags(editTagsWatch)),
    [editTagsWatch]
  );

  useEffect(() => {
    if (!isCreateDialogOpen) {
      createForm.reset({
        name: "",
        tags: "",
        description: "",
      });
    }
  }, [isCreateDialogOpen, createForm]);

  useEffect(() => {
    if (editingPreset) {
      editForm.reset({
        id: editingPreset.id,
        name: editingPreset.name,
        tags: editingPreset.tags,
        description: editingPreset.description ?? "",
      });
    }
  }, [editingPreset, editForm]);

  const handleCreateSubmit = createForm.handleSubmit((data) => {
    const normalized = {
      ...data,
      tags: normalizeHashtagPresetTags(data.tags),
    };
    const formData = formDataToFormData(normalized, "create_hashtag_preset");
    fetcher.submit(formData, { method: "post" });
    setIsCreateDialogOpen(false);
  });

  const handleEditSubmit = editForm.handleSubmit((data) => {
    if (!editingPreset) return;
    const normalized = {
      ...data,
      tags: normalizeHashtagPresetTags(data.tags),
    };
    const formData = formDataToFormData(normalized, "update_hashtag_preset");
    fetcher.submit(formData, { method: "post" });
    setEditingPreset(null);
    setIsEditDialogOpen(false);
  });

  const runDelete = (id: string) => {
    const formData = new FormData();
    formData.set("_action", "delete_hashtag_preset");
    formData.set("id", id);
    fetcher.submit(formData, { method: "post" });
  };

  const openEditDialog = (preset: HashTagPreset) => {
    setEditingPreset(preset);
    setIsEditDialogOpen(true);
  };

  const pendingDeleteLinkedCount =
    presetPendingDelete !== null
      ? countLinkedQueues(queueTypes, presetPendingDelete.id)
      : 0;

  return (
    <>
      <ManagementListSection
        title="Hashtag presets"
        description="Reusable hashtag sets for posts and queue defaults—keep campaigns consistent and publish faster."
        primaryAction={
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                New preset
              </Button>
            </DialogTrigger>
            <DialogContent className="flex max-h-[min(90vh,640px)] flex-col gap-0 overflow-hidden sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create preset</DialogTitle>
                <DialogDescription>
                  Save a tag set you can attach to queues and posts.
                </DialogDescription>
              </DialogHeader>
              <form
                id="hashtag-preset-create-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleCreateSubmit(e);
                }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 pb-2">
                  <div className="space-y-2">
                    <Label htmlFor="create-name">Name</Label>
                    <Input
                      id="create-name"
                      {...createForm.register("name")}
                      placeholder="e.g. Product launch"
                      disabled={isSubmitting}
                    />
                    {createForm.formState.errors.name ? (
                      <p className="text-danger text-sm">
                        {createForm.formState.errors.name.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-tags">Hashtags</Label>
                    <Textarea
                      id="create-tags"
                      {...createForm.register("tags")}
                      placeholder="#bitcoin #nostr"
                      disabled={isSubmitting}
                      rows={3}
                      className="font-mono text-sm"
                    />
                    {createForm.formState.errors.tags ? (
                      <p className="text-danger text-sm">
                        {createForm.formState.errors.tags.message}
                      </p>
                    ) : null}
                    <p className="text-text-secondary text-xs">
                      Space-separated. Tags are normalized to start with # on
                      save.
                    </p>
                    {createPreviewTags.length > 0 ? (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {createPreviewTags.map((t) => (
                          <span
                            key={t}
                            className="bg-surface-hover text-text-secondary rounded-xs px-1.5 py-0.5 text-[11px]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-description">
                      Description (optional)
                    </Label>
                    <Input
                      id="create-description"
                      {...createForm.register("description")}
                      placeholder="When to use this preset"
                      disabled={isSubmitting}
                    />
                    {createForm.formState.errors.description ? (
                      <p className="text-danger text-sm">
                        {createForm.formState.errors.description.message}
                      </p>
                    ) : null}
                  </div>
                </div>
              </form>
              <DialogFooter className="border-border/60 gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="hashtag-preset-create-form"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating…" : "Create preset"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {presets.length === 0 ? (
          <div className="text-text-secondary py-10 text-center">
            <Hash
              className="mx-auto mb-3 h-10 w-10 opacity-[0.35]"
              aria-hidden
            />
            <p className="text-text mb-1 text-sm font-medium">
              No hashtag presets yet
            </p>
            <p className="mx-auto mb-5 max-w-md text-xs leading-relaxed">
              Presets store hashtag sets you reuse across posts and attach to
              queue types—faster publishing and consistent campaigns.
            </p>
            <Button
              type="button"
              onClick={() => setIsCreateDialogOpen(true)}
              size="sm"
              variant="outline"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create first preset
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {presets.map((preset) => {
              const allTags = parseTagList(preset.tags);
              const visible = allTags.slice(0, MAX_TAG_CHIPS_VISIBLE);
              const more = allTags.length - visible.length;
              const linked = countLinkedQueues(queueTypes, preset.id);
              return (
                <div
                  key={preset.id}
                  className="border-border/80 hover:bg-surface-hover/40 flex flex-col gap-3 rounded-lg border px-3 py-3 transition-colors sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-medium tracking-tight">
                        {preset.name}
                      </h3>
                      {allTags.length > 0 ? (
                        <span className="text-text-secondary bg-surface-hover/80 rounded-xs px-1.5 py-0.5 text-[10px] leading-none">
                          {allTags.length} tags
                        </span>
                      ) : null}
                    </div>
                    {preset.description ? (
                      <p className="text-text-secondary line-clamp-2 text-xs leading-relaxed">
                        {preset.description}
                      </p>
                    ) : null}
                    {visible.length > 0 ? (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {visible.map((tag) => (
                          <span
                            key={tag}
                            className="bg-surface-hover text-text-secondary max-w-[140px] truncate rounded-xs px-1.5 py-0.5 text-[11px]"
                          >
                            {tag}
                          </span>
                        ))}
                        {more > 0 ? (
                          <span className="text-text-secondary text-[11px]">
                            +{more} more
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-text-secondary text-[11px]">
                        No tags yet
                      </p>
                    )}
                    {linked > 0 ? (
                      <p className="text-text-secondary pt-0.5 text-[11px]">
                        Used by {linked} queue{linked === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center justify-end gap-1 sm:pt-0.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9"
                      onClick={() => openEditDialog(preset)}
                      disabled={isSubmitting}
                      aria-label={`Edit ${preset.name}`}
                    >
                      <Edit2 className={INLINE_ICON_SIZE_CLASS} />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-danger hover:bg-danger/10 hover:text-danger h-9 w-9"
                      onClick={() => setPresetPendingDelete(preset)}
                      disabled={isSubmitting}
                      aria-label={`Delete ${preset.name}`}
                    >
                      <Trash2 className={INLINE_ICON_SIZE_CLASS} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {fetcher.data?.success ? (
          <p className="text-success mt-4 text-sm">
            Hashtag preset updated successfully!
          </p>
        ) : null}
        {fetcher.data?.error ? (
          <p className="text-danger mt-4 text-sm">{fetcher.data.error}</p>
        ) : null}
      </ManagementListSection>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="flex max-h-[min(90vh,640px)] flex-col gap-0 overflow-hidden sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit preset</DialogTitle>
            <DialogDescription>
              Update name, tags, or description.
            </DialogDescription>
          </DialogHeader>
          <form
            id="hashtag-preset-edit-form"
            onSubmit={(e) => {
              e.preventDefault();
              void handleEditSubmit(e);
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 pb-2">
              <input type="hidden" id="edit-id" {...editForm.register("id")} />
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  {...editForm.register("name")}
                  placeholder="e.g. Product launch"
                  disabled={isSubmitting}
                />
                {editForm.formState.errors.name ? (
                  <p className="text-danger text-sm">
                    {editForm.formState.errors.name.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-tags">Hashtags</Label>
                <Textarea
                  id="edit-tags"
                  {...editForm.register("tags")}
                  placeholder="#bitcoin #nostr"
                  disabled={isSubmitting}
                  rows={3}
                  className="font-mono text-sm"
                />
                {editForm.formState.errors.tags ? (
                  <p className="text-danger text-sm">
                    {editForm.formState.errors.tags.message}
                  </p>
                ) : null}
                <p className="text-text-secondary text-xs">
                  Space-separated. Tags are normalized on save.
                </p>
                {editPreviewTags.length > 0 ? (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {editPreviewTags.map((t) => (
                      <span
                        key={t}
                        className="bg-surface-hover text-text-secondary rounded-xs px-1.5 py-0.5 text-[11px]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description (optional)</Label>
                <Input
                  id="edit-description"
                  {...editForm.register("description")}
                  placeholder="When to use this preset"
                  disabled={isSubmitting}
                />
                {editForm.formState.errors.description ? (
                  <p className="text-danger text-sm">
                    {editForm.formState.errors.description.message}
                  </p>
                ) : null}
              </div>
            </div>
          </form>
          <DialogFooter className="border-border/60 gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="hashtag-preset-edit-form"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={presetPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPresetPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete hashtag preset?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-text-secondary space-y-2 text-sm">
                <p>
                  {presetPendingDelete
                    ? `“${presetPendingDelete.name}” will be removed.`
                    : null}
                </p>
                {presetPendingDelete && pendingDeleteLinkedCount > 0 ? (
                  <p>
                    {pendingDeleteLinkedCount} queue
                    {pendingDeleteLinkedCount === 1 ? " uses" : "s use"} this
                    preset—they will lose the linked preset (queues stay; timing
                    unchanged).
                  </p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={() => {
                if (presetPendingDelete) {
                  runDelete(presetPendingDelete.id);
                  setPresetPendingDelete(null);
                }
              }}
            >
              Delete preset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
