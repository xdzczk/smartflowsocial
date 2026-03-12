import { type FetcherWithComponents } from "@remix-run/react";
import type { MutableRefObject } from "react";

import { type ToastMessage } from "~/components/types";
import { uploadMany as uploadMultipleFiles } from "~/features/upload/media.client";
import { nowMillis, nowUTC } from "~/lib/temporal";

import type { BulkPost } from "../types";

import { type FetcherData } from "./bulk-post-events.utils";
import {
  buildUploadFormData,
  createFakeFileUrlData,
  getFileUrlArray,
} from "./bulk-post-events.utils";

/** Prepare repost/quote posts by setting fake fileUrls on fetcher and dispatching event for server handling. */
export function runRepostOrQuotePreparation(
  posts: BulkPost[],
  fetcher: FetcherWithComponents<FetcherData>,
  setPreparationProgress?: (p: {
    current: number;
    total: number;
    stage: string;
  }) => void
): void {
  const fakeFileUrls = createFakeFileUrlData(posts);
  (fetcher as { data?: unknown }).data = { fileUrls: fakeFileUrls };
  setPreparationProgress?.({
    current: 1,
    total: 4,
    stage: "Processing reposts...",
  });
  document.dispatchEvent(new CustomEvent("repostEventsPrepared"));
}

export interface UploadPreparationParams {
  posts: BulkPost[];
  fetcher: FetcherWithComponents<FetcherData>;
  setPreparationProgress?: (p: {
    current: number;
    total: number;
    stage: string;
  }) => void;
  extraFormData?: Record<string, string>;
  submitAction?: string;
  isWaitingForUploadRef: MutableRefObject<boolean>;
  setToast: (t: ToastMessage | null) => void;
  setIsPreviewSubmitting: (v: boolean) => void;
  /** Optional dev logging (e.g. no-op in prod). */
  log?: (...args: unknown[]) => void;
}

export async function runUploadPreparation(
  params: UploadPreparationParams
): Promise<boolean> {
  const {
    posts,
    fetcher,
    setPreparationProgress,
    extraFormData,
    submitAction,
    isWaitingForUploadRef,
    setToast,
    setIsPreviewSubmitting,
    log = () => {},
  } = params;

  const filesToUpload = posts.flatMap((post) => post.files);

  if (filesToUpload.length > 0) {
    try {
      setPreparationProgress?.({
        current: 0,
        total: filesToUpload.length + 3,
        stage: `Starting upload of ${filesToUpload.length} files...`,
      });
      const uploadStartTime = nowMillis();
      const uploadResults = await uploadMultipleFiles(
        filesToUpload,
        (completed, total, message) => {
          setPreparationProgress?.({
            current: completed,
            total: total + 3,
            stage: message,
          });
        }
      );
      log(
        `[BulkPosts] Uploads completed in ${nowMillis() - uploadStartTime}ms (${filesToUpload.length} files)`
      );
      const failedUploads = uploadResults.filter((r) => !r.success);
      if (failedUploads.length > 0) {
        throw new Error(
          `Upload failed: ${failedUploads.map((r) => r.error).join(", ")}`
        );
      }
      let urlIndex = 0;
      const fileUrlsPerPost: string[][] = posts.map((post) => {
        const urls: string[] = [];
        for (let j = 0; j < post.files.length; j++) {
          const url = uploadResults[urlIndex]?.file?.url ?? "";
          if (url) urls.push(url);
          urlIndex++;
        }
        return urls;
      });
      setPreparationProgress?.({
        current: filesToUpload.length + 1,
        total: filesToUpload.length + 3,
        stage: "Processing uploads...",
      });
      const formData = buildUploadFormData(
        posts,
        fileUrlsPerPost,
        extraFormData
      );
      log(
        `[BulkPosts] Submitting to server at ${nowUTC().toInstant().toString()}`
      );
      isWaitingForUploadRef.current = true;
      fetcher.submit(formData, {
        method: "post",
        ...(submitAction ? { action: submitAction } : {}),
      });
      return true;
    } catch (error: unknown) {
      const { handleAsyncErrorWithMessage, getErrorMessage } =
        await import("~/lib/error-handler.client");
      const errorMessage = `Upload failed: ${getErrorMessage(error)}`;
      handleAsyncErrorWithMessage(
        error,
        errorMessage,
        { component: "useBulkPostEvents", action: "prepareEvents" },
        false
      );
      setToast({ type: "error", message: errorMessage });
      setTimeout(() => setToast(null), 5000);
      setIsPreviewSubmitting(false);
      return false;
    }
  }

  setPreparationProgress?.({ current: 1, total: 4, stage: "Processing..." });
  const fileUrlsPerPost = posts.map((post) => getFileUrlArray(post));
  const formData = buildUploadFormData(posts, fileUrlsPerPost, extraFormData);
  log(
    `[BulkPosts] Submitting to server (no uploads) at ${nowUTC().toInstant().toString()}`
  );
  isWaitingForUploadRef.current = true;
  fetcher.submit(formData, {
    method: "post",
    ...(submitAction ? { action: submitAction } : {}),
  });
  return true;
}
