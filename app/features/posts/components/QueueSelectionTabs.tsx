import {
  Link,
  useNavigate,
  useParams,
  useRevalidator,
  useSearchParams,
} from "@remix-run/react";
import { useEffect, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import { getQueueColor } from "../queue-colors";
import type { QueueType } from "../types";

/** Use dropdown on mobile (≤768px) or when queue count would overflow tabs */
const QUEUE_DROPDOWN_THRESHOLD = 6;
const MOBILE_BREAKPOINT_PX = 768;

interface QueueSelectionTabsProps {
  currentTab: string;
  queueTypes: Array<QueueType | string>;
  basePath?: string;
}

function usePrefersDropdown(queueCount: number): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`).matches
      : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
    const fn = () => setIsMobile(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return isMobile || queueCount > QUEUE_DROPDOWN_THRESHOLD;
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
  const useDropdown = usePrefersDropdown(queueTypes.length);

  const useQueryParams = !params["queueType"];
  const currentValue =
    params["queueType"] ?? searchParams.get("queueType") ?? "all";

  const baseClasses =
    "whitespace-nowrap border-b-2 px-1 py-1.5 text-xs font-medium capitalize rounded focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset";
  const unselectedClasses =
    "border-transparent text-muted-foreground hover:border-border hover:text-foreground";

  const handleDropdownChange = (value: string) => {
    if (value === "all") {
      navigate(useQueryParams ? `${basePath}?tab=${currentTab}` : basePath);
    } else if (useQueryParams) {
      navigate(`${basePath}?tab=${currentTab}&queueType=${value}`);
    } else {
      navigate(`${basePath}/${value}?tab=${currentTab}`);
    }
    setTimeout(() => revalidator.revalidate(), 0);
  };

  if (useDropdown) {
    return (
      <div className="border-border w-full max-w-[12rem] min-w-0 min-w-[8rem] flex-shrink-0 border-b-0 sm:max-w-[14rem]">
        <Select value={currentValue} onValueChange={handleDropdownChange}>
          <SelectTrigger
            className="h-9 border-0 border-b-2 border-transparent bg-transparent px-1 py-1.5 text-xs font-medium shadow-none focus:ring-0 focus:ring-offset-0 [&>svg]:ml-0"
            aria-label="Filter by queue"
          >
            <SelectValue placeholder="Queue" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Queues</SelectItem>
            {queueTypes.map((queueType) => {
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

  return (
    <div className="border-border min-w-0 flex-shrink-0 border-b">
      <nav
        className="scrollbar-hide -mb-px flex space-x-6 overflow-x-auto"
        aria-label="Queue Types"
      >
        <Link
          to={`${basePath}?tab=${currentTab}`}
          prefetch="intent"
          onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
          className={`${baseClasses} border-b-2 ${
            (!params["queueType"] && !searchParams.get("queueType")) ||
            searchParams.get("queueType") === "all"
              ? "border-border text-foreground dark:border-primary dark:text-primary"
              : unselectedClasses
          }`}
        >
          All Queues
        </Link>
        {queueTypes.map((queueType) => {
          const queueName =
            typeof queueType === "string" ? queueType : queueType.name;
          const queueColor =
            typeof queueType === "object" ? queueType.color : null;
          const colors = getQueueColor(queueName, queueColor);
          const isSelected =
            params["queueType"] === queueName ||
            searchParams.get("queueType") === queueName;

          const queueTypePath = useQueryParams
            ? `${basePath}?tab=${currentTab}&queueType=${queueName}`
            : `${basePath}/${queueName}?tab=${currentTab}`;

          if (isSelected && queueColor) {
            return (
              <Link
                key={
                  typeof queueType === "object"
                    ? queueType.id || queueName
                    : queueName
                }
                to={queueTypePath}
                prefetch="intent"
                onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
                className={`${baseClasses} border-b-2`}
                style={{
                  borderBottomColor: queueColor,
                  color: queueColor,
                }}
              >
                {queueName}
              </Link>
            );
          }

          return (
            <Link
              key={
                typeof queueType === "object"
                  ? queueType.id || queueName
                  : queueName
              }
              to={queueTypePath}
              prefetch="intent"
              onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
              className={`${baseClasses} ${
                isSelected && colors
                  ? `${colors.border.replace("border-", "border-b-") || "border-b-primary"} ${colors.text}`
                  : unselectedClasses
              }`}
            >
              {queueName}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
