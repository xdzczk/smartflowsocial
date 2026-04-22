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

import type { QueueType } from "../types";

interface QueueSelectionTabsProps {
  currentTab: string;
  queueTypes: Array<QueueType | string>;
  basePath?: string;
}

export default function QueueSelectionTabs({
  currentTab,
  queueTypes,
  basePath = "/dashboard",
}: QueueSelectionTabsProps) {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const revalidator = useRevalidator();

  const useQueryParams = !params["queueType"];
  const currentValue =
    params["queueType"] ?? searchParams.get("queueType") ?? "all";

  const handleDropdownChange = (value: string) => {
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
    <div className="border-border w-full max-w-[12rem] min-w-0 min-w-[8rem] flex-shrink-0 border-b-0 sm:max-w-[14rem]">
      <Select value={currentValue} onValueChange={handleDropdownChange}>
        <SelectTrigger
          className="h-9 border-0 border-b-2 border-transparent bg-transparent px-1 py-1.5 text-sm font-medium shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 [&>svg]:ml-0"
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
              return name !== "Unassigned"; // Sentinel only; no DB "Unassigned" queue
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
    </div>
  );
}
