/**
 * Web Share Target receiver (/share-target).
 *
 * Registered from public/manifest.json as:
 *   { action: "/share-target", method: "GET",
 *     params: { title, text, url } }
 *
 * When the user picks SmartFlow from the system share sheet, the OS navigates
 * here with the shared payload encoded as query params. We:
 *
 *   1. Parse title/text/url from the URL.
 *   2. If the user isn't authenticated, send them to /login and drop the payload
 *      (we don't want to persist shared content in a signed-out browser).
 *   3. Compose the fields into a single string using a sensible separator.
 *   4. Merge into the composer's local draft (`composer-newpost-post-draft`)
 *      so the composer hydrates with the shared text pre-filled, leveraging
 *      the existing `useComposerLocalDraft` restore path.
 *   5. Redirect to `/dashboard/compose?source=share-target`.
 *
 * The merge-into-draft step is client-only (localStorage). The loader just
 * forwards the parsed payload; a tiny client bridge on this route performs
 * the write and then triggers the redirect.
 */
import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";

import { Logo } from "~/components/ui/Logo";
import { getUser } from "~/features/auth";
import { BRAND_NAME } from "~/lib/brand";

const TARGET_COMPOSER_PATH = "/dashboard/compose?source=share-target";
const DRAFT_STORAGE_KEY = "composer-newpost-post-draft";

interface LoaderPayload {
  title: string;
  text: string;
  url: string;
  composed: string;
  hasContent: boolean;
}

function sanitizeParam(raw: string | null): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  // 4,000 char cap so a malicious share (or a huge article body) can't
  // blow out localStorage quota or break the composer.
  if (trimmed.length > 4000) return trimmed.slice(0, 4000);
  return trimmed;
}

function composeSharedString(title: string, text: string, url: string): string {
  const parts: string[] = [];
  if (title && title !== text) parts.push(title);
  if (text) parts.push(text);
  if (url && !text.includes(url) && !title.includes(url)) parts.push(url);
  return parts.join("\n\n");
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await getUser(request);
  const url = new URL(request.url);

  // Signed out: send them to login. We intentionally drop the share payload
  // rather than persist it across an auth boundary.
  if (!user) {
    return redirect("/?source=share-target");
  }

  const title = sanitizeParam(url.searchParams.get("title"));
  const text = sanitizeParam(url.searchParams.get("text"));
  const sharedUrl = sanitizeParam(url.searchParams.get("url"));
  const composed = composeSharedString(title, text, sharedUrl);

  if (!composed) {
    // Empty share (edge case: some Android apps share empty placeholder)  -
    // just open the composer.
    return redirect(TARGET_COMPOSER_PATH);
  }

  const payload: LoaderPayload = {
    title,
    text,
    url: sharedUrl,
    composed,
    hasContent: true,
  };

  return payload;
};

export const meta: MetaFunction = () => [
  { title: `Share to ${BRAND_NAME}` },
  // Don't let search engines or third-party fetchers index this handoff page.
  { name: "robots", content: "noindex, nofollow" },
];

/** Minimal `ComposerLocalSnapshot` shape we write into localStorage. */
interface ComposerLocalSnapshotLike {
  version?: number;
  contentType?: "post" | "thread" | "poll" | "article";
  content: string;
  queueType: string;
  queueTypeId: string | null;
  scheduledFor: string;
  tags: string;
  hashTagPresetId: string | null;
  includeHashtagsInNoteBody?: boolean;
  attachmentMeta: Array<{ localId: string; url: string; alt?: string }>;
  savedAt: number;
}

function readExistingDraft(): ComposerLocalSnapshotLike | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed != null &&
      typeof parsed === "object" &&
      "content" in parsed &&
      typeof parsed.content === "string"
    ) {
      return parsed as ComposerLocalSnapshotLike;
    }
    return null;
  } catch {
    return null;
  }
}

function writeDraft(snapshot: ComposerLocalSnapshotLike): void {
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore quota / private mode  -  we'll still redirect; the user just has to paste.
  }
}

/**
 * Merge the shared content into the existing draft (if any) and redirect to
 * the composer. Running in a React effect keeps us in a proper client render
 * window (localStorage is not available during SSR).
 */
export default function ShareTargetRoute() {
  const data = useLoaderData<typeof loader>() as LoaderPayload | undefined;
  const navigate = useNavigate();
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!data?.hasContent) {
      navigate(TARGET_COMPOSER_PATH, { replace: true });
      return;
    }

    try {
      const existing = readExistingDraft();
      const hasExistingContent = (existing?.content.trim().length ?? 0) > 0;
      const nextContent = hasExistingContent
        ? `${existing!.content}\n\n${data.composed}`
        : data.composed;

      const snapshot: ComposerLocalSnapshotLike = {
        version: existing?.version ?? 1,
        contentType: existing?.contentType ?? "post",
        content: nextContent,
        queueType: existing?.queueType ?? "",
        queueTypeId: existing?.queueTypeId ?? null,
        scheduledFor: existing?.scheduledFor ?? "",
        tags: existing?.tags ?? "",
        hashTagPresetId: existing?.hashTagPresetId ?? null,
        includeHashtagsInNoteBody: existing?.includeHashtagsInNoteBody ?? false,
        attachmentMeta: existing?.attachmentMeta ?? [],
        savedAt: Date.now(),
      };
      writeDraft(snapshot);
    } catch {
      // Schedule the setState out of the synchronous effect body
      // (react-hooks/set-state-in-effect); the UI just shows a fallback copy.
      queueMicrotask(() => setErrored(true));
    }

    // Delay one microtask so the draft write commits before the composer's
    // mount effect reads it. Empirically 0ms is enough; 50ms gives a safety margin.
    const id = window.setTimeout(() => {
      navigate(TARGET_COMPOSER_PATH, { replace: true });
    }, 50);
    return () => window.clearTimeout(id);
  }, [data, navigate]);

  return (
    <div className="bg-canvas safe-x flex min-h-dvh items-center justify-center p-4">
      <div className="border-border-subtle bg-surface shadow-1 flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border p-6 text-center">
        <Logo
          lightSrc="/logos/Logo-Full-LightMode.svg"
          darkSrc="/logos/Logo-Full-DarkMode.svg"
          alt={BRAND_NAME}
          className="h-8 w-auto"
        />
        <p className="text-text text-sm font-semibold">
          {errored
            ? "Couldn't stash your share  -  taking you to the composer anyway."
            : "Preparing your post…"}
        </p>
        <p className="text-text-secondary text-xs">
          {errored
            ? "Paste from your clipboard once the composer opens."
            : "We're filling the composer with the shared content."}
        </p>
      </div>
    </div>
  );
}
