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
import { UNDERLINE_FILTER_FOCUS_CLASS } from "~/features/posts/components/constants";
import { cn } from "~/lib/utils";

interface QueueType {
  name: string;
  color?: string | null;
}

interface RecyclablesQueueFilterProps {
  queueTypes: QueueType[] | string[];
}

/**
 * Queue filter dropdown for Recyclables page (right side of filter row).
 * Uses path param: /dashboard/recyclables or /dashboard/recyclables/:queueType.
 * Preserves searchParams (dateFrom, dateTo, olderThan, engagementType, engagementMin).
 */
export function RecyclablesQueueFilter({
  queueTypes,
}: RecyclablesQueueFilterProps) {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const revalidator = useRevalidator();

  const currentValue = params["queueType"] ?? "all";
  const searchSuffix = searchParams.toString()
    ? `?${searchParams.toString()}`
    : "";

  const handleChange = (value: string) => {
    const path =
      value === "all"
        ? "/dashboard/recyclables"
        : `/dashboard/recyclables/${encodeURIComponent(value)}`;
    navigate(`${path}${searchSuffix}`);
    setTimeout(() => revalidator.revalidate(), 0);
  };

  return (
    <div className="border-border w-full max-w-[12rem] min-w-0 min-w-[8rem] flex-shrink-0 border-b-0 sm:max-w-[14rem]">
      <Select value={currentValue} onValueChange={handleChange}>
        <SelectTrigger
          className={cn(
            "h-9 border-0 border-b-2 border-transparent bg-transparent px-1 py-1.5 text-sm font-medium shadow-none [&>svg]:ml-0",
            UNDERLINE_FILTER_FOCUS_CLASS
          )}
          aria-label="Filter by queue"
        >
          <SelectValue placeholder="Queue" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Queues</SelectItem>
          <SelectItem value="unassigned">Unassigned</SelectItem>
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
                  ? ((queueType as { id?: string }).id ?? queueName)
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
