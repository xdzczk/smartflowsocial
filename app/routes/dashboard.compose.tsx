import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import {
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import {
  getComposeMode,
  NewPostPage,
  shouldDispatchToLongform,
} from "~/features/posts/composer";
import { NewLongFormPostPage } from "~/features/posts/longform";
import {
  handleNewPostAction,
  loadNewPostData,
} from "~/features/posts/server/composer";
import {
  handleNewLongFormAction,
  loadNewLongFormData,
} from "~/features/posts/server/longform";
import { withCSRFProtection } from "~/lib/csrf";

const COMPOSE_PATHNAME = "/dashboard/compose";

function ComposeTransitionShell() {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="text-muted-foreground text-sm">Loading composer…</p>
    </div>
  );
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const url = new URL(request.url);
    const type = url.searchParams.get("type");

    if (getComposeMode(type) === "article") {
      const templateId = url.searchParams.get("templateId");
      const payload = await loadNewLongFormData(
        userId,
        templateId && templateId.length > 0 ? templateId : null
      );
      return json({
        ...payload,
        __composeMode: "article" as const,
      });
    }

    const draftId = url.searchParams.get("draftId");
    const templateId = url.searchParams.get("templateId");
    const payload = await loadNewPostData(
      userId,
      draftId && draftId.length > 0 ? draftId : null,
      templateId && templateId.length > 0 ? templateId : null
    );
    return json({
      ...payload,
      __composeMode: "shortform" as const,
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
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();

  const queryType = searchParams.get("type");
  const urlMode = getComposeMode(queryType);
  const loaderMode = data.__composeMode ?? urlMode;

  const urlDiscriminatorMismatch =
    data.__composeMode !== undefined && data.__composeMode !== urlMode;

  const navigatingWithinCompose =
    navigation.state === "loading" &&
    navigation.location.pathname === COMPOSE_PATHNAME;

  const destinationMode = navigatingWithinCompose
    ? getComposeMode(
        new URLSearchParams(navigation.location.search).get("type")
      )
    : null;

  if (urlDiscriminatorMismatch) {
    return <ComposeTransitionShell />;
  }

  if (
    navigatingWithinCompose &&
    destinationMode !== null &&
    destinationMode !== loaderMode
  ) {
    return <ComposeTransitionShell />;
  }

  if (loaderMode === "article") {
    return <NewLongFormPostPage />;
  }
  return <NewPostPage />;
}

export function ErrorBoundary() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold">
        Composer temporarily unavailable
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Something went wrong while loading the composer. Please retry in a few
        seconds.
      </p>
    </div>
  );
}
