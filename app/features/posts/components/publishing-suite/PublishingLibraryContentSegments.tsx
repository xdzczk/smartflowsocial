import { useParams, useSearchParams } from "@remix-run/react";

import { buildLibraryContentTypeFilterItems } from "./build-library-content-segment-links";
import { PublishingContentTypeFilter } from "./PublishingContentTypeFilter";

export function PublishingLibraryContentSegments({
  basePath,
  currentTab,
  totalContentCount,
  totalPostsCount,
  totalRepostsCount,
  totalFollowUpsCount,
  totalLongformCount,
  ariaLabel = "Content type",
  "data-testid": dataTestId,
}: {
  basePath: string;
  currentTab: string;
  totalContentCount: number;
  totalPostsCount: number;
  totalRepostsCount: number;
  totalFollowUpsCount: number;
  totalLongformCount: number;
  ariaLabel?: string;
  "data-testid"?: string;
}) {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const queuePathSegment = params["queueType"] ? `/${params["queueType"]}` : "";

  const items = buildLibraryContentTypeFilterItems({
    basePath,
    queuePathSegment,
    searchParams,
    totalContentCount,
    totalPostsCount,
    totalRepostsCount,
    totalFollowUpsCount,
    totalLongformCount,
  });

  return (
    <PublishingContentTypeFilter
      value={currentTab}
      items={items}
      ariaLabel={ariaLabel}
      data-testid={dataTestId}
    />
  );
}
