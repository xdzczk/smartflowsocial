import { useFetcher } from "@remix-run/react";
import { Plus, Edit2, Trash2, Hash } from "lucide-react";
import { useState, useEffect } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import {
  createHashtagPresetClientSchema,
  updateHashtagPresetClientSchema,
} from "~/lib/validation";
import {
  useZodForm,
  formDataToFormData,
} from "~/lib/validation/utils.client-safe";

interface HashTagPreset {
  id: string;
  name: string;
  tags: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface HashtagPresetsSettingsProps {
  presets: HashTagPreset[];
}

interface FetcherData {
  success?: boolean;
  error?: string;
}

export function HashtagPresetsSettings({
  presets,
}: HashtagPresetsSettingsProps) {
  const fetcher = useFetcher<FetcherData>();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<HashTagPreset | null>(
    null
  );

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

  // Reset create form when dialog closes
  useEffect(() => {
    if (!isCreateDialogOpen) {
      createForm.reset({
        name: "",
        tags: "",
        description: "",
      });
    }
  }, [isCreateDialogOpen, createForm]);

  // Update edit form when editing preset changes
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
    const formData = formDataToFormData(data, "create_hashtag_preset");
    fetcher.submit(formData, { method: "post" });
    setIsCreateDialogOpen(false);
  });

  const handleEditSubmit = editForm.handleSubmit((data) => {
    if (!editingPreset) return;
    const formData = formDataToFormData(data, "update_hashtag_preset");
    fetcher.submit(formData, { method: "post" });
    setEditingPreset(null);
    setIsEditDialogOpen(false);
  });

  const handleDelete = (id: string) => {
    if (
      window.confirm("Are you sure you want to delete this hashtag preset?")
    ) {
      const formData = new FormData();
      formData.set("_action", "delete_hashtag_preset");
      formData.set("id", id);
      fetcher.submit(formData, { method: "post" });
    }
  };

  const openEditDialog = (preset: HashTagPreset) => {
    setEditingPreset(preset);
    setIsEditDialogOpen(true);
  };

  const countHashtags = (tags: string): number => {
    return tags
      .split(/\s+/)
      .filter((tag) => tag.startsWith("#") && tag.length > 1).length;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Hashtag Presets
            </CardTitle>
            <CardDescription>
              Create and manage reusable hashtag collections for your posts
            </CardDescription>
          </div>

          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Preset
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Hashtag Preset</DialogTitle>
                <DialogDescription>
                  Create a new hashtag preset to reuse across your posts
                </DialogDescription>
              </DialogHeader>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleCreateSubmit(e);
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="create-name">Preset Name</Label>
                  <Input
                    id="create-name"
                    {...createForm.register("name")}
                    placeholder="e.g., Tech Posts, Travel Content"
                    disabled={isSubmitting}
                  />
                  {createForm.formState.errors.name ? (
                    <p className="text-destructive text-sm">
                      {createForm.formState.errors.name.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-tags">Hashtags</Label>
                  <Textarea
                    id="create-tags"
                    {...createForm.register("tags")}
                    placeholder="#bitcoin #nostr #technology #coding"
                    disabled={isSubmitting}
                    rows={3}
                  />
                  {createForm.formState.errors.tags ? (
                    <p className="text-destructive text-sm">
                      {createForm.formState.errors.tags.message}
                    </p>
                  ) : null}
                  <p className="text-muted-foreground text-xs">
                    Separate hashtags with spaces. Each hashtag should start
                    with #
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-description">
                    Description (optional)
                  </Label>
                  <Input
                    id="create-description"
                    {...createForm.register("description")}
                    placeholder="Brief description of when to use this preset"
                    disabled={isSubmitting}
                  />
                  {createForm.formState.errors.description ? (
                    <p className="text-destructive text-sm">
                      {createForm.formState.errors.description.message}
                    </p>
                  ) : null}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Creating..." : "Create Preset"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {presets.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            <Hash className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="mb-2 text-lg font-medium">No hashtag presets yet</p>
            <p className="mb-4 text-sm">
              Create your first hashtag preset to organize and reuse hashtags
              across your posts
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Preset
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="hover:bg-muted flex items-start justify-between rounded-lg border p-4 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-sm font-medium">{preset.name}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {countHashtags(preset.tags)} tags
                    </Badge>
                  </div>

                  {preset.description ? (
                    <p className="text-muted-foreground mb-2 text-xs">
                      {preset.description}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-1">
                    {preset.tags
                      .split(/\s+/)
                      .filter((tag) => tag.startsWith("#") && tag.length > 1)
                      .map((tag, index) => (
                        <Badge
                          // eslint-disable-next-line react/no-array-index-key -- Stable list of tags, no unique ID available
                          key={index}
                          variant="outline"
                          className="px-2 py-0 text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                  </div>
                </div>

                <div className="ml-4 flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditDialog(preset)}
                    disabled={isSubmitting}
                  >
                    <Edit2 className={INLINE_ICON_SIZE_CLASS} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(preset.id)}
                    disabled={isSubmitting}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className={INLINE_ICON_SIZE_CLASS} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {fetcher.data?.success ? (
          <p className="text-success mt-4 text-sm">
            Hashtag preset updated successfully!
          </p>
        ) : null}
        {fetcher.data?.error ? (
          <p className="text-destructive mt-4 text-sm">{fetcher.data.error}</p>
        ) : null}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Hashtag Preset</DialogTitle>
            <DialogDescription>Update your hashtag preset</DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleEditSubmit(e);
            }}
            className="space-y-4"
          >
            <input type="hidden" id="edit-id" {...editForm.register("id")} />
            <div className="space-y-2">
              <Label htmlFor="edit-name">Preset Name</Label>
              <Input
                id="edit-name"
                {...editForm.register("name")}
                placeholder="e.g., Tech Posts, Travel Content"
                disabled={isSubmitting}
              />
              {editForm.formState.errors.name ? (
                <p className="text-destructive text-sm">
                  {editForm.formState.errors.name.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-tags">Hashtags</Label>
              <Textarea
                id="edit-tags"
                {...editForm.register("tags")}
                placeholder="#bitcoin #nostr #technology #coding"
                disabled={isSubmitting}
                rows={3}
              />
              {editForm.formState.errors.tags ? (
                <p className="text-destructive text-sm">
                  {editForm.formState.errors.tags.message}
                </p>
              ) : null}
              <p className="text-muted-foreground text-xs">
                Separate hashtags with spaces. Each hashtag should start with #
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Input
                id="edit-description"
                {...editForm.register("description")}
                placeholder="Brief description of when to use this preset"
                disabled={isSubmitting}
              />
              {editForm.formState.errors.description ? (
                <p className="text-destructive text-sm">
                  {editForm.formState.errors.description.message}
                </p>
              ) : null}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
