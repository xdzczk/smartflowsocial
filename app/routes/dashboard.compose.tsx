import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import {
  useLoaderData,
  useLocation,
  useNavigate,
  useNavigation,
} from "@remix-run/react";
import { lazy, Suspense } from "react";

import { ComposerSkeleton } from "~/components/skeletons/ComposerSkeleton";
import { Skeleton } from "~/components/ui/skeleton";
import { requireUserId } from "~/features/auth";
import {
  parseComposerContext,
  CreateComposerShell,
  getComposeMode,
  normalizeComposeType,
  shouldDispatchToLongform,
  type ComposeContentType,
} from "~/features/posts/composer";
import {
  handleNewPostAction,
  loadNewPostData,
} from "~/features/posts/server/composer";
import {
  handleNewLongFormAction,
  loadNewLongFormData,
} from "~/features/posts/server/longform";
import { withCSRFProtection } from "~/lib/csrf";

/** When pending search drops `type` but we are still on article (or other) compose mode, keep discriminator so loader vs URL mode stay aligned. */
function mergeComposeTypeFromLocation(
  locationSearch: string,
  pendingSearch: string
): string {
  const loc = new URLSearchParams(
    locationSearch.startsWith("?") ? locationSearch.slice(1) : locationSearch
  );
  const locType = loc.get("type");
  if (locType == null || locType === "") return pendingSearch;

  const pendingRaw = pendingSearch.startsWith("?")
    ? pendingSearch.slice(1)
    : pendingSearch;
  const pendingParams = new URLSearchParams(pendingRaw);
  if (pendingParams.has("type")) return pendingSearch;

  pendingParams.set("type", locType);
  const merged = pendingParams.toString();
  return merged.length > 0 ? `?${merged}` : locationSearch;
}

function useEffectiveComposeSearch(): string {
  const navigation = useNavigation();
  const location = useLocation();
  if (navigation.state === "loading") {
    const nav = navigation.location;
    // Pending location sometimes omits `search` on same-path navigations (e.g. tab
    // switches) while the address bar still has `?type=article`. Using empty search
    // makes urlMode "shortform" and mismatches article loader data → skeleton flash.
    if (nav.pathname === location.pathname) {
      const pending = nav.search;
      if (pending.length <= 1) {
        return location.search;
      }
      return mergeComposeTypeFromLocation(location.search, pending);
    }
    return nav.search || location.search;
  }
  return location.search;
}

function typeParamFromComposeSearch(search: string): string | null {
  const q = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(q).get("type");
}

/**
 * Same-path navigations (e.g. stripping `published=`) sometimes leave `navigation.location.search`
 * without `type` while the committed URL still has `?type=article`. That made urlMode "shortform"
 * and `__composeMode` "article" → endless ComposeSkeletonLayout.
 */
function composeRouteTypeParam(
  effectiveSearch: string,
  locationSearch: string
): string | null {
  return (
    typeParamFromComposeSearch(effectiveSearch) ??
    typeParamFromComposeSearch(locationSearch)
  );
}

function composeShellTitle(contentType: ComposeContentType): string {
  if (contentType === "poll") return "Create poll";
  if (contentType === "thread") return "Create thread";
  if (contentType === "article") return "Create article";
  return "Create post";
}

/** Header + tabs + skeleton body while loader catches up to the URL (or after a recoverable error). */
function ComposeSkeletonLayout() {
  const location = useLocation();
  const effectiveSearch = useEffectiveComposeSearch();
  const queryType = composeRouteTypeParam(effectiveSearch, location.search);
  const contentType = normalizeComposeType(queryType);
  const navigate = useNavigate();
  const navigation = useNavigation();

  return (
    <CreateComposerShell
      contentType={contentType}
      onContentTypeChange={(next) => {
        if (navigation.state !== "idle") return;
        if (next === "article") {
          navigate("/dashboard/compose?type=article");
          return;
        }
        navigate(
          `/dashboard/compose?type=${encodeURIComponent(next === "post" ? "post" : next)}`
        );
      }}
      title={composeShellTitle(contentType)}
      reserveTitleStatusSlot
      composerHeaderActions={
        <div
          className="pointer-events-none flex shrink-0 items-center gap-0.5 sm:gap-1"
          aria-hidden
        >
          <Skeleton className="h-8 w-[3.25rem] rounded-md" />
          <Skeleton className="h-8 w-[4.5rem] rounded-md" />
        </div>
      }
    >
      <ComposerSkeleton />
    </CreateComposerShell>
  );
}

const LazyNewPostPage = lazy(async () => {
  const mod = await import("~/features/posts/composer");
  return { default: mod.NewPostPage };
});

const LazyNewLongFormPostPage = lazy(async () => {
  const mod = await import("~/features/posts/longform");
  return { default: mod.NewLongFormPostPage };
});

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const composerContextResult = parseComposerContext(url.searchParams);
    const composerContext = composerContextResult.context;

    if (getComposeMode(type) === "article") {
      const templateId = url.searchParams.get("templateId");
      const payload = await loadNewLongFormData(
        userId,
        templateId && templateId.length > 0 ? templateId : null,
        composerContext
      );
      return json({
        ...payload,
        __composeMode: "article" as const,
      });
    }

    const draftId = url.searchParams.get("draftId");
    const templateId = url.searchParams.get("templateId");
    const payload = await loadNewPostData(userId, {
      draftId: draftId && draftId.length > 0 ? draftId : null,
      templateId: templateId && templateId.length > 0 ? templateId : null,
      composerContext,
    });
    return json({
      ...payload,
      __composeMode: "shortform" as const,
      composerContextError: composerContextResult.error,
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    const url = new URL(request.url);
    const mode = getComposeMode(url.searchParams.get("type"));
    return json({
      scheduleIntervals: [],
      queueTypes: [],
      hashTagPresets: [],
      relays: [],
      templates: [],
      tags: "",
      userTimezone: "Etc/GMT",
      uploadProvider: null,
      initialTemplateData: null,
      __composeMode: mode,
      composerContext: { mode: "create" as const },
      hydrationStatus: "error" as const,
      hydrationError: "Composer data temporarily unavailable",
      // Keep loader failures local and non-fatal during fast tab transitions.
      error: {
        message: "Composer data temporarily unavailable",
      },
    });
  }
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      const userId = await requireUserId(request);
      const url = new URL(request.url);
      const type = url.searchParams.get("type");
      const formData = await request.clone().formData();
      const contentType = String(formData.get("contentType") ?? "");
      const actionType = String(formData.get("_action") ?? "");

      if (
        shouldDispatchToLongform({
          queryType: type,
          contentType: contentType || null,
          actionType: actionType || null,
        })
      ) {
        return await handleNewLongFormAction(userId, request);
      }
      return await handleNewPostAction(userId, request);
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

export default function ComposePage() {
  const data = useLoaderData<{
    __composeMode?: "shortform" | "article";
  }>();
  const location = useLocation();
  const effectiveSearch = useEffectiveComposeSearch();
  const queryType = composeRouteTypeParam(effectiveSearch, location.search);
  const urlMode = getComposeMode(queryType);
  const loaderMode = data.__composeMode ?? urlMode;

  const urlDiscriminatorMismatch =
    data.__composeMode !== undefined && data.__composeMode !== urlMode;

  if (urlDiscriminatorMismatch) {
    return <ComposeSkeletonLayout />;
  }

  if (loaderMode === "article") {
    return (
      <Suspense fallback={<ComposeSkeletonLayout />}>
        <LazyNewLongFormPostPage />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<ComposeSkeletonLayout />}>
      <LazyNewPostPage />
    </Suspense>
  );
}

export function ErrorBoundary() {
  return <ComposeSkeletonLayout />;
}
