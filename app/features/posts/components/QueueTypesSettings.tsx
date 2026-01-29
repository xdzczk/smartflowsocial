import { useFetcher, useRevalidator } from "@remix-run/react";
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
  const revalidator = useRevalidator();

  const [queueTypesState, setQueueTypesState] = useState(queueTypes);
  const [showDialog, setShowDialog] = useState(false);
  const [editingQueueType, setEditingQueueType] = useState<QueueType | null>(
    null
  );

  const _isCreating = createFetcher.state === "submitting";
  const _isUpdating = updateFetcher.state === "submitting";
  const isDeleting = deleteFetcher.state === "submitting";

  // Sync list when loader data changes (e.g. after revalidation following create/update/delete)
  useEffect(() => {
    setQueueTypesState(queueTypes);
  }, [queueTypes]);

  // Delete uses its own fetcher from QueueTypeCard; create/update use the dialog's fetcher
  useEffect(() => {
    if (deleteFetcher.data?.success) {
      revalidator.revalidate();
      toast.success("Queue type deleted successfully!");
    }
    if (deleteFetcher.data?.error) {
      toast.error(deleteFetcher.data.error);
    }
  }, [deleteFetcher.data, revalidator]);

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
