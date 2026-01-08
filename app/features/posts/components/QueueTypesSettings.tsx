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

import type { QueueType } from "../types";

import { QueueTypeCard } from "./QueueTypeCard";
import { QueueTypeDialog } from "./QueueTypeDialog";

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
  hashTagPresets: Array<{
    id: string;
    name: string;
    tags: string;
    description?: string;
  }>;
}

export function QueueTypesSettings({
  queueTypes,
  hashTagPresets,
}: QueueTypesSettingsProps) {
  interface FetcherData {
    success?: boolean;
    error?: string;
  }
  const createFetcher = useFetcher<FetcherData>();
  const updateFetcher = useFetcher<FetcherData>();
  const deleteFetcher = useFetcher<FetcherData>();

  const [queueTypesState, setQueueTypesState] = useState(queueTypes || []);
  const [showDialog, setShowDialog] = useState(false);
  const [editingQueueType, setEditingQueueType] = useState<QueueType | null>(
    null
  );

  const _isCreating = createFetcher.state === "submitting";
  const _isUpdating = updateFetcher.state === "submitting";
  const isDeleting = deleteFetcher.state === "submitting";

  useEffect(() => {
    if (queueTypes) {
      // Defer to avoid cascading renders
      setTimeout(() => {
        setQueueTypesState(queueTypes);
      }, 0);
    }
  }, [queueTypes]);

  // Close dialog on successful submission
  useEffect(() => {
    if (createFetcher.data?.success) {
      // Defer to avoid cascading renders
      setTimeout(() => {
        setShowDialog(false);
        toast.success("Queue type created successfully!");
      }, 0);
    }
    if (createFetcher.data?.error) {
      toast.error(createFetcher.data.error);
    }
  }, [createFetcher.data]);

  useEffect(() => {
    if (updateFetcher.data?.success) {
      // Defer to avoid cascading renders
      setTimeout(() => {
        setEditingQueueType(null);
        toast.success("Queue type updated successfully!");
      }, 0);
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
            <p className="text-muted-foreground py-8 text-center">
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
