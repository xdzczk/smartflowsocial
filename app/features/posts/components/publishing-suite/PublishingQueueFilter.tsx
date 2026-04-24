import {
  useNavigate,
  useParams,
  useRevalidator,
  useSearchParams,
} from "@remix-run/react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { QueueType } from "~/features/posts/types";
import { cn } from "~/lib/utils";

import { PUBLISHING_FILTER_SELECT_TRIGGER_CLASS } from "./constants";

export function PublishingQueueFilter({
  currentTab,
  basePath = "/dashboard",
  queueTypes,
  triggerClassName,
}: {
  currentTab: string;
  basePath?: string;
  queueTypes: Array<QueueType | string>;
  /** Extra classes for the trigger (e.g. dashboard Flow toolbar). */
  triggerClassName?: string;
}) {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const useQueryParams = !params["queueType"];
  const currentValue =
    params["queueType"] ?? searchParams.get("queueType") ?? "all";

  const navigateToQueue = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", currentTab);
    if (value === "all") {
      next.delete("queueType");
      navigate(`${basePath}?${next.toString()}`);
    } else if (useQueryParams) {
      next.set("queueType", value);
      navigate(`${basePath}?${next.toString()}`);
    } else {
      navigate(`${basePath}/${value}?${next.toString()}`);
    }
    setTimeout(() => revalidator.revalidate(), 0);
  };

  return (
    <Select
      name="queueType"
      value={currentValue}
      onValueChange={navigateToQueue}
    >
      <SelectTrigger
        className={cn(PUBLISHING_FILTER_SELECT_TRIGGER_CLASS, triggerClassName)}
        aria-label="Filter by queue"
      >
        <SelectValue placeholder="Queue" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All queues</SelectItem>
        <SelectItem value="unassigned">No queue</SelectItem>
        {queueTypes
          .filter((qt) => {
            const name = typeof qt === "string" ? qt : qt.name;
            return name !== "Unassigned";
          })
          .map((queueType) => {
            const queueName =
              typeof queueType === "string" ? queueType : queueType.name;
            const key =
              typeof queueType === "object"
                ? queueType.id || queueName
                : queueName;
            return (
              <SelectItem key={key} value={queueName}>
                {queueName}
              </SelectItem>
            );
          })}
      </SelectContent>
    </Select>
  );
}
