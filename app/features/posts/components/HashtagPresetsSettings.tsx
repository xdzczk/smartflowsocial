import { useFetcher } from "@remix-run/react";
import { Plus, Edit2, Trash2, Hash } from "lucide-react";
import { useState } from "react";

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
    null,
  );

  const [createForm, setCreateForm] = useState({
    name: "",
    tags: "",
    description: "",
  });

  const [editForm, setEditForm] = useState({
    name: "",
    tags: "",
    description: "",
  });

  const isSubmitting = fetcher.state === "submitting";

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.set("_action", "create_hashtag_preset");
    formData.set("name", createForm.name);
    formData.set("tags", createForm.tags);
    formData.set("description", createForm.description);

    fetcher.submit(formData, { method: "post" });
    setCreateForm({ name: "", tags: "", description: "" });
    setIsCreateDialogOpen(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPreset) return;

    const formData = new FormData();
    formData.set("_action", "update_hashtag_preset");
    formData.set("id", editingPreset.id);
    formData.set("name", editForm.name);
    formData.set("tags", editForm.tags);
    formData.set("description", editForm.description);

    fetcher.submit(formData, { method: "post" });
    setEditingPreset(null);
    setIsEditDialogOpen(false);
  };

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
    setEditForm({
      name: preset.name,
      tags: preset.tags,
      description: preset.description ?? "",
    });
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

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="create-name">Preset Name</Label>
                  <Input
                    id="create-name"
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="e.g., Tech Posts, Travel Content"
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-tags">Hashtags</Label>
                  <Textarea
                    id="create-tags"
                    value={createForm.tags}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        tags: e.target.value,
                      }))
                    }
                    placeholder="#bitcoin #nostr #technology #coding"
                    required
                    disabled={isSubmitting}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
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
                    value={createForm.description}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Brief description of when to use this preset"
                    disabled={isSubmitting}
                  />
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
          <div className="py-8 text-center text-muted-foreground">
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
                className="flex items-start justify-between rounded-lg border p-4 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-sm font-medium">{preset.name}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {countHashtags(preset.tags)} tags
                    </Badge>
                  </div>

                  {preset.description ? (
                    <p className="mb-2 text-xs text-muted-foreground">
                      {preset.description}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-1">
                    {preset.tags
                      .split(/\s+/)
                      .filter((tag) => tag.startsWith("#") && tag.length > 1)
                      .map((tag, index) => (
                        <Badge
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
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(preset.id)}
                    disabled={isSubmitting}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {fetcher.data?.success ? (
          <p className="mt-4 text-sm text-green-600">
            Hashtag preset updated successfully!
          </p>
        ) : null}
        {fetcher.data?.error ? (
          <p className="mt-4 text-sm text-destructive">{fetcher.data.error}</p>
        ) : null}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Hashtag Preset</DialogTitle>
            <DialogDescription>Update your hashtag preset</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Preset Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Tech Posts, Travel Content"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-tags">Hashtags</Label>
              <Textarea
                id="edit-tags"
                value={editForm.tags}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, tags: e.target.value }))
                }
                placeholder="#bitcoin #nostr #technology #coding"
                required
                disabled={isSubmitting}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Separate hashtags with spaces. Each hashtag should start with #
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Input
                id="edit-description"
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Brief description of when to use this preset"
                disabled={isSubmitting}
              />
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
