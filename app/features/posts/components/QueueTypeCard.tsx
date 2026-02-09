import type { FetcherWithComponents } from "@remix-run/react";
import { Edit, Trash2 } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";

import { getQueueAccentHex } from "../queue-colors";
import {
  isIntervalScheduleConfig,
  isFixedSlotsScheduleConfig,
  isWeeklySlotsScheduleConfig,
} from "../types";
import type { QueueType } from "../types";
interface QueueTypeCardProps {
  queueType: QueueType & {
    isDefault?: boolean;
    hashTagPreset?: { id: string; name: string } | null;
  };
  onEdit: (queueType: QueueType) => void;
  isDeletingQueueType: boolean;
  deleteFetcher: FetcherWithComponents<{ success?: boolean; error?: string }>;
}

export function QueueTypeCard({
  queueType,
  onEdit,
  isDeletingQueueType,
  deleteFetcher,
}: QueueTypeCardProps) {
  const handleDelete = () => {
    const formData = new FormData();
    formData.set("_action", "delete_queue_type");
    formData.set("id", queueType.id);
    deleteFetcher.submit(formData, { method: "post" });
  };

  const DAY_SHORT_LABELS = [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
  ] as const;

  const getScheduleDescription = () => {
    if (!queueType.scheduleConfig) return "No schedule configured";
    if (queueType.scheduleType === "INTERVAL") {
      if (
        isIntervalScheduleConfig(queueType.scheduleConfig) &&
        queueType.scheduleConfig.useGlobalInterval
      ) {
        return "Uses global schedule intervals";
      }
      if (isIntervalScheduleConfig(queueType.scheduleConfig)) {
        return `Every ${String(queueType.scheduleConfig.intervalHours ?? 0)} hours`;
      }
      return "Invalid interval configuration";
    }
    if (queueType.scheduleType === "WEEKLY_SLOTS") {
      if (isWeeklySlotsScheduleConfig(queueType.scheduleConfig)) {
        const parts = queueType.scheduleConfig.weeklySlots.map(
          (slot) => `${DAY_SHORT_LABELS[slot.dayOfWeek] ?? "?"} ${slot.time}`
        );
        return `Weekly: ${parts.join(", ") || "None"}`;
      }
      return "Invalid weekly slots configuration";
    }
    if (isFixedSlotsScheduleConfig(queueType.scheduleConfig)) {
      return `Fixed slots: ${queueType.scheduleConfig.slots.join(", ") || "None"}`;
    }
    return "Invalid slots configuration";
  };

  return (
    <Card className="hover:bg-muted transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className="h-4 w-4 rounded-full"
              style={{
                backgroundColor:
                  queueType.colorToken != null && queueType.colorToken !== ""
                    ? getQueueAccentHex(queueType.colorToken)
                    : (queueType.color ?? "#6B7280"),
              }}
            />
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <h4 className="font-medium">{queueType.name}</h4>
                {queueType.isDefault ? (
                  <Badge variant="secondary" className="text-xs">
                    Default
                  </Badge>
                ) : null}
                {!queueType.isEnabled ? (
                  <Badge variant="outline" className="text-xs">
                    Disabled
                  </Badge>
                ) : null}
              </div>
              {queueType.description ? (
                <p className="text-muted-foreground text-sm">
                  {queueType.description}
                </p>
              ) : null}
              <p className="text-muted-foreground text-xs">
                {getScheduleDescription()}
              </p>
              {queueType.hashTagPreset ? (
                <div className="flex items-center space-x-1">
                  <Badge variant="outline" className="text-xs">
                    #{queueType.hashTagPreset.name}
                  </Badge>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(queueType)}
            >
              <Edit className={INLINE_ICON_SIZE_CLASS} />
            </Button>
            {!queueType.isDefault ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeletingQueueType}
              >
                <Trash2 className={INLINE_ICON_SIZE_CLASS} />
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
