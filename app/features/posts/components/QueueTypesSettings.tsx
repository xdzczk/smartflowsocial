import { useFetcher } from "@remix-run/react";
import { Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

import { QueueTypeCard } from "./QueueTypeCard";
import { QueueTypeDialog } from "./QueueTypeDialog";
import type { QueueType } from "~/features/posts/types";

interface QueueTypeSettings extends QueueType {
  isDefault: boolean;
  hashTagPreset?: {
    id: string;
    name: string;
    tags: string;
    description?: string;
  } | null;
  hashTagPresetId?: string;
}

interface QueueTypesSettingsProps {
  queueTypes: QueueTypeSettings[];
  hashTagPresets: {
    id: string;
    name: string;
    tags: string;
    description?: string;
  }[];
}

export function QueueTypesSettings({
  queueTypes,
  hashTagPresets,
}: QueueTypesSettingsProps) {
  const createFetcher = useFetcher();
  const updateFetcher = useFetcher();
  const deleteFetcher = useFetcher();

  const [queueTypesState, setQueueTypesState] = useState(queueTypes || []);
  const [showDialog, setShowDialog] = useState(false);
  const [editingQueueType, setEditingQueueType] = useState<QueueType | null>(
    null,
  );

  const isCreating = createFetcher.state === "submitting";
  const isUpdating = updateFetcher.state === "submitting";
  const isDeleting = deleteFetcher.state === "submitting";

  useEffect(() => {
    if (queueTypes) {
      setQueueTypesState(queueTypes);
    }
  }, [queueTypes]);

  // Close dialog on successful submission
  useEffect(() => {
    if (createFetcher.data?.success) {
      setShowDialog(false);
      toast.success("Queue type created successfully!");
    }
    if (createFetcher.data?.error) {
      toast.error(createFetcher.data.error);
    }
  }, [createFetcher.data]);

  useEffect(() => {
    if (updateFetcher.data?.success) {
      setEditingQueueType(null);
      toast.success("Queue type updated successfully!");
    }
    if (updateFetcher.data?.error) {
      toast.error(updateFetcher.data.error);
    }
  }, [updateFetcher.data]);

  useEffect(() => {
    if (deleteFetcher.data?.success) {
      toast.success("Queue type deleted successfully!");
    }
    if (deleteFetcher.data?.error) {
      toast.error(deleteFetcher.data.error);
    }
  }, [deleteFetcher.data]);

  const handleCreateNew = () => {
    setEditingQueueType(null);
    setShowDialog(true);
  };

  const handleEdit = (queueType: QueueType) => {
    setEditingQueueType(queueType);
    setShowDialog(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      setEditingQueueType(null);
    }
    setShowDialog(open);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Queue Types</CardTitle>
              <CardDescription>
                Manage your posting queues with custom scheduling
              </CardDescription>
            </div>
            <Button onClick={handleCreateNew}>
              <Plus className="mr-2 h-4 w-4" />
              Add Queue Type
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {queueTypesState.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No queue types found. Create your first queue type to get started.
            </p>
          ) : (
            queueTypesState.map((queueType) => (
              <QueueTypeCard
                key={queueType.id}
                queueType={queueType}
                onEdit={handleEdit}
                isDeletingQueueType={isDeleting}
                deleteFetcher={deleteFetcher}
              />
            ))
          )}
        </CardContent>
      </Card>

      <QueueTypeDialog
        open={showDialog}
        onOpenChange={handleDialogOpenChange}
        queueType={editingQueueType}
        hashTagPresets={hashTagPresets}
      />
    </>
  );
}
