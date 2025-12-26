import type { FetcherWithComponents } from "@remix-run/react";
import { Edit, Trash2 } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import type { QueueType } from "~/features/posts/types";
import { isIntervalScheduleConfig, isFixedSlotsScheduleConfig } from "~/features/posts/types";

interface QueueTypeCardProps {
  queueType: QueueType & { isDefault?: boolean; hashTagPreset?: { id: string; name: string } | null };
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

  const getScheduleDescription = () => {
    if (!queueType.scheduleConfig) return "No schedule configured";
    if (queueType.scheduleType === "INTERVAL") {
      if (isIntervalScheduleConfig(queueType.scheduleConfig) && queueType.scheduleConfig.useGlobalInterval) {
        return "Uses global schedule intervals";
      }
      if (isIntervalScheduleConfig(queueType.scheduleConfig)) {
        return `Every ${queueType.scheduleConfig.intervalHours} hours`;
      }
      return "Invalid interval configuration";
    } else {
      if (isFixedSlotsScheduleConfig(queueType.scheduleConfig)) {
        return `Fixed slots: ${queueType.scheduleConfig.slots?.join(", ") || "None"}`;
      }
      return "Invalid slots configuration";
    }
  };

  return (
    <Card className="transition-colors hover:bg-accent/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className="h-4 w-4 rounded-full"
              style={{ backgroundColor: queueType.color || "#6B7280" }}
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
                <p className="text-sm text-muted-foreground">
                  {queueType.description}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
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
              <Edit className="h-4 w-4" />
            </Button>
            {!queueType.isDefault ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeletingQueueType}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
