import { useFetcher, useRevalidator } from "@remix-run/react";
import { ListTree, Plus } from "lucide-react";
import { useCallback, useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";

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
import { EmptyState } from "~/components/ui/empty-state";
import { ManagementListSection } from "~/features/settings/components/patterns";

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
  /** User's global composer interval hours (from settings loader). */
  globalScheduleIntervalHours: number[];
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

type QueueDeleteMode = "queue_only" | "queue_and_scheduled";

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
    colorToken: (raw["colorToken"] as string | null | undefined) ?? undefined,
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
    includeHashtagsInNoteBody:
      raw["includeHashtagsInNoteBody"] === false ? false : true,
  };
}

export function QueueTypesSettings({
  queueTypes,
  globalScheduleIntervalHours,
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
  const [queuePendingDelete, setQueuePendingDelete] =
    useState<QueueTypeSettings | null>(null);
  const lastHandledDeleteRef = useRef<unknown>(null);
  const lastHandledFormRef = useRef<unknown>(null);
  const lastRevalidatedFormRef = useRef<unknown>(null);
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

  // Create/Update: revalidate once per success (guard to avoid revalidation loop). Optimistic add via onQueueCreatedOrUpdated.
  useEffect(() => {
    const data = formFetcher.data;
    if (data?.success && data.queueType) {
      if (lastRevalidatedFormRef.current !== data) {
        lastRevalidatedFormRef.current = data;
        revalidator.revalidate();
      }
    }
    if (data?.error) {
      toast.error(data.error);
    }
  }, [formFetcher.data, revalidator]);

  const handleQueueCreatedOrUpdated = useCallback(
    (data: { success?: boolean; error?: string; queueType?: unknown }) => {
      if (lastHandledFormRef.current === data) return;
      lastHandledFormRef.current = data;
      const normalized = normalizeQueueTypeFromAction(
        data.queueType as FetcherData["queueType"]
      );
      if (normalized) {
        setQueueTypesState((prev) => {
          const idx = prev.findIndex((q) => q.id === normalized.id);
          if (idx >= 0) return prev.map((q, i) => (i === idx ? normalized : q));
          return [...prev, normalized];
        });
      }
    },
    []
  );

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

  const confirmDeleteQueue = (deleteMode: QueueDeleteMode) => {
    if (!queuePendingDelete) return;
    const formData = new FormData();
    formData.set("_action", "delete_queue_type");
    formData.set("id", queuePendingDelete.id);
    formData.set("deleteMode", deleteMode);
    deleteFetcher.submit(formData, { method: "post" });
    setQueuePendingDelete(null);
  };

  return (
    <>
      <ManagementListSection
        title="Queues"
        description="Posting queues and how each one schedules work."
        primaryAction={
          <Button onClick={handleCreateNew} size="sm" variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Add queue
          </Button>
        }
      >
        {queueTypesState.length === 0 ? (
          <EmptyState
            icon={<ListTree />}
            title="No queues yet"
            description="Queues define reusable publishing schedules. Create one to reuse timing logic across posts and keep publishing consistent."
            action={
              <Button
                type="button"
                onClick={handleCreateNew}
                size="sm"
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create first queue
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {queueTypesState.map((queueType) => (
              <QueueTypeCard
                key={queueType.id}
                queueType={queueType}
                globalScheduleIntervalHours={globalScheduleIntervalHours}
                onEdit={handleEdit}
                isDeletingQueueType={isDeleting}
                deleteFetcher={deleteFetcher}
                onDeleteRequest={(qt) =>
                  setQueuePendingDelete(qt as QueueTypeSettings)
                }
              />
            ))}
          </div>
        )}
      </ManagementListSection>

      <AlertDialog
        open={queuePendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setQueuePendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete queue type?</AlertDialogTitle>
            <AlertDialogDescription>
              {queuePendingDelete
                ? `Choose how to remove “${queuePendingDelete.name}”. Delete queue only keeps scheduled content and marks it unassigned. Delete queue + scheduled removes both the queue and all scheduled posts/articles using it.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="border-border bg-canvas text-text hover:bg-surface-hover hover:text-text border"
              onClick={() => confirmDeleteQueue("queue_only")}
            >
              Delete queue only
            </AlertDialogAction>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={() => confirmDeleteQueue("queue_and_scheduled")}
            >
              Delete queue + scheduled
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QueueTypeDialog
        open={showDialog}
        onOpenChange={handleDialogOpenChange}
        queueType={editingQueueType}
        hashTagPresets={hashTagPresets}
        formFetcher={formFetcher}
        onQueueCreatedOrUpdated={handleQueueCreatedOrUpdated}
      />
    </>
  );
}
