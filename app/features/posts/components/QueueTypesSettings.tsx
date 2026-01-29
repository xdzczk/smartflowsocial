import { useFetcher, useRevalidator } from "@remix-run/react";
import { Plus } from "lucide-react";
import { useState, useEffect, useRef } from "react";
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

interface FetcherData {
  success?: boolean;
  error?: string;
  deletedId?: string;
  queueType?: QueueTypeSettings;
}

function normalizeQueueTypeFromAction(
  qt: FetcherData["queueType"]
): QueueTypeSettings | null {
  if (!qt || typeof qt !== "object" || !("id" in qt) || !("name" in qt))
    return null;
  const raw = qt as unknown as Record<string, unknown>;
  const scheduleType = raw["scheduleType"];
  const validScheduleType =
    scheduleType === "INTERVAL" ||
    scheduleType === "FIXED_SLOTS" ||
    scheduleType === "WEEKLY_SLOTS"
      ? scheduleType
      : "INTERVAL";
  return {
    id: raw["id"] as string,
    name: raw["name"] as string,
    color: (raw["color"] as string | null) ?? null,
    description: (raw["description"] as string | null) ?? null,
    scheduleType: validScheduleType,
    scheduleConfig:
      raw["scheduleConfig"] &&
      typeof raw["scheduleConfig"] === "object" &&
      !Array.isArray(raw["scheduleConfig"])
        ? (raw["scheduleConfig"] as QueueTypeSettings["scheduleConfig"])
        : undefined,
    isEnabled: typeof raw["isEnabled"] === "boolean" ? raw["isEnabled"] : true,
    isDefault: typeof raw["isDefault"] === "boolean" ? raw["isDefault"] : false,
    hashTagPreset:
      raw["hashTagPreset"] && typeof raw["hashTagPreset"] === "object"
        ? (raw["hashTagPreset"] as QueueTypeSettings["hashTagPreset"])
        : null,
  };
}

export function QueueTypesSettings({
  queueTypes,
  hashTagPresets,
}: QueueTypesSettingsProps) {
  const formFetcher = useFetcher<FetcherData>();
  const deleteFetcher = useFetcher<FetcherData>();
  const revalidator = useRevalidator();

  const [queueTypesState, setQueueTypesState] = useState(queueTypes);
  const [showDialog, setShowDialog] = useState(false);
  const [editingQueueType, setEditingQueueType] = useState<QueueType | null>(
    null
  );
  const lastHandledDeleteRef = useRef<unknown>(null);
  const lastHandledFormRef = useRef<unknown>(null);
  const prevQueueTypesRef = useRef(queueTypes);

  const _isCreating = formFetcher.state === "submitting";
  const _isUpdating = formFetcher.state === "submitting";
  const isDeleting = deleteFetcher.state === "submitting";

  // Sync from loader only when the list of ids actually changed (e.g. navigation or revalidation caught up).
  // Avoid syncing on every parent re-render (new array reference) so we don't overwrite optimistic updates.
  // Defer setState to avoid synchronous setState in effect (react-hooks/set-state-in-effect).
  useEffect(() => {
    const prevIds = prevQueueTypesRef.current
      .map((q) => q.id)
      .sort()
      .join(",");
    const nextIds = queueTypes
      .map((q) => q.id)
      .sort()
      .join(",");
    if (prevIds !== nextIds) {
      prevQueueTypesRef.current = queueTypes;
      queueMicrotask(() => setQueueTypesState(queueTypes));
    }
  }, [queueTypes]);

  // Delete: optimistic remove + toast, revalidate in background.
  // Defer setState to avoid synchronous setState in effect (react-hooks/set-state-in-effect).
  useEffect(() => {
    const data = deleteFetcher.data;
    if (data?.success && lastHandledDeleteRef.current !== data) {
      lastHandledDeleteRef.current = data;
      if (typeof data.deletedId === "string") {
        const deletedId = data.deletedId;
        queueMicrotask(() =>
          setQueueTypesState((prev) => prev.filter((q) => q.id !== deletedId))
        );
      }
      revalidator.revalidate();
      toast.success("Queue type deleted successfully!");
    }
    if (data?.error) {
      toast.error(data.error);
    }
  }, [deleteFetcher.data, revalidator]);

  // Create/Update: optimistic add or replace so list updates immediately.
  // Defer setState to avoid synchronous setState in effect (react-hooks/set-state-in-effect).
  useEffect(() => {
    const data = formFetcher.data;
    if (
      data?.success &&
      data.queueType &&
      lastHandledFormRef.current !== data
    ) {
      lastHandledFormRef.current = data;
      const normalized = normalizeQueueTypeFromAction(data.queueType);
      if (normalized) {
        queueMicrotask(() =>
          setQueueTypesState((prev) => {
            const idx = prev.findIndex((q) => q.id === normalized.id);
            if (idx >= 0)
              return prev.map((q, i) => (i === idx ? normalized : q));
            return [...prev, normalized];
          })
        );
      }
      revalidator.revalidate();
    }
    if (data?.error) {
      toast.error(data.error);
    }
  }, [formFetcher.data, revalidator]);

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
        formFetcher={formFetcher}
      />
    </>
  );
}
