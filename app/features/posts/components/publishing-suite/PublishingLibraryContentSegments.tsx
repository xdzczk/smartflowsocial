import { useNavigate, useParams, useSearchParams } from "@remix-run/react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { CONTENT_MOBILE_BREAKPOINT_PX } from "~/features/posts/components/constants";
import { useIsMobile } from "~/lib/hooks/useIsMobile";

import { buildLibraryContentSegmentLinkItems } from "./build-library-content-segment-links";
import { PUBLISHING_FILTER_SELECT_TRIGGER_CLASS } from "./constants";
import { PublishingSegmentedControlLinks } from "./PublishingSegmentedControl";

export function PublishingLibraryContentSegments({
  basePath,
  currentTab,
  totalContentCount,
  totalPostsCount,
  totalRepostsCount,
  totalLongformCount,
  ariaLabel = "Content type",
  "data-testid": dataTestId,
}: {
  basePath: string;
  currentTab: string;
  totalContentCount: number;
  totalPostsCount: number;
  totalRepostsCount: number;
  totalLongformCount: number;
  ariaLabel?: string;
  "data-testid"?: string;
}) {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile(CONTENT_MOBILE_BREAKPOINT_PX);
  const queuePathSegment = params["queueType"] ? `/${params["queueType"]}` : "";

  const items = buildLibraryContentSegmentLinkItems({
    basePath,
    queuePathSegment,
    searchParams,
    totalContentCount,
    totalPostsCount,
    totalRepostsCount,
    totalLongformCount,
  });

  if (isMobile) {
    const active = items.find((i) => i.id === currentTab) ?? items[0];
    const mobileLabel = active?.label ?? currentTab;

    return (
      <Select
        value={currentTab}
        onValueChange={(tab) => {
          const target = items.find((i) => i.id === tab);
          if (target) navigate(target.to);
        }}
      >
        <SelectTrigger
          className={PUBLISHING_FILTER_SELECT_TRIGGER_CLASS}
          aria-label={ariaLabel}
          data-testid={dataTestId}
        >
          <SelectValue>{mobileLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <PublishingSegmentedControlLinks
      data-testid={dataTestId}
      ariaLabel={ariaLabel}
      activeId={currentTab}
      items={items}
    />
  );
}
