import { useNavigate } from "@remix-run/react";
import { useState, useCallback } from "react";
import { toast } from "react-hot-toast";

import { logClientError } from "~/lib/error-handler.client";
interface UploadProvider {
  provider: "S3" | "BLOSSOM_PRIMAL" | "BLOSSOM_BLOSSTR" | "BLOSSOM_SFS";
  isUsingBlossom: boolean;
  enableMirrorBlossom?: boolean;
  mirrorUploadUrls?: string[];
}

interface SubmitOptions {
  method: string;
  encType?: string;
  action?: string;
}

const TOAST_ID_BLOSSOM_AUTH = "blossom-auth";

export function useBlossomAwareUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [response, setResponse] = useState<Record<string, unknown> | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const checkUploadProvider = async (): Promise<UploadProvider> => {
    try {
      const response = await fetch("/api/user-upload-provider");
      if (!response.ok) throw new Error("Failed to check provider");
      const data = (await response.json()) as {
        provider?: string;
        enableMirrorBlossom?: boolean;
        mirrorUploadUrls?: string[];
      };

      const {
        provider,
        enableMirrorBlossom = false,
        mirrorUploadUrls = [],
      } = data;

      // Handle legacy BLOSSOM value as BLOSSOM_PRIMAL
      if (provider === "BLOSSOM" || provider === "BLOSSOM_PRIMAL") {
        return {
          provider: "BLOSSOM_PRIMAL",
          isUsingBlossom: true,
          enableMirrorBlossom,
          mirrorUploadUrls,
        };
      }
      if (provider === "BLOSSOM_BLOSSTR") {
        return {
          provider: "BLOSSOM_BLOSSTR",
          isUsingBlossom: true,
          enableMirrorBlossom,
          mirrorUploadUrls,
        };
      }
      if (provider === "BLOSSOM_SFS") {
        return {
          provider: "BLOSSOM_SFS",
          isUsingBlossom: true,
          enableMirrorBlossom,
          mirrorUploadUrls,
        };
      }
      return {
        provider: "S3",
        isUsingBlossom: false,
        enableMirrorBlossom: false,
        mirrorUploadUrls: [],
      };
    } catch (error) {
      logClientError(
        error instanceof Error ? error : new Error(String(error)),
        {
          component: "useBlossomAwareUpload",
          action: "checkUploadProvider",
        }
      );
      return {
        provider: "S3",
        isUsingBlossom: false,
        enableMirrorBlossom: false,
        mirrorUploadUrls: [],
      };
    }
  };

  const createBlossomAuthHeaders = async (
    provider: "BLOSSOM_PRIMAL" | "BLOSSOM_BLOSSTR" | "BLOSSOM_SFS"
  ) => {
    // @ts-ignore - Dynamic imports work in client-side Remix bundles
    const { getWindowNostrLikeSigner } =
      await import("~/lib/nostr-signer-manager.client");
    const signer = await getWindowNostrLikeSigner();
    if (!signer) {
      throw new Error(
        "Nostr signer not found. Please connect a signer (NIP-07 extension or NIP-46 remote signer) to upload to Blossom."
      );
    }

    const _uploadUrl =
      provider === "BLOSSOM_PRIMAL"
        ? "https://blossom.primal.net/upload"
        : provider === "BLOSSOM_SFS"
          ? "https://blossom-api.smartflow.social/upload"
          : "https://blosstr.com/upload";

    // Note: Authentication should be handled by the upload service directly
    throw new Error(
      "Blossom auth not implemented in useBlossomAwareUpload. Use upload.client.ts instead."
    );
  };

  const submitForm = useCallback(
    async (formData: FormData, options: SubmitOptions) => {
      setIsUploading(true);
      setUploadProgress(10);
      setError(null);

      try {
        // Check upload provider
        const providerInfo = await checkUploadProvider();
        setUploadProgress(20);

        let headers: Record<string, string> = {};

        // If using any Blossom provider, create auth headers and show progress
        if (providerInfo.isUsingBlossom) {
          setUploadProgress(30);
          const providerName =
            providerInfo.provider === "BLOSSOM_PRIMAL"
              ? "Primal"
              : providerInfo.provider === "BLOSSOM_SFS"
                ? "SmartFlow Blossom"
                : "Blosstr";

          // Log mirror configuration if enabled
          if (
            providerInfo.enableMirrorBlossom &&
            providerInfo.mirrorUploadUrls?.length
          ) {
            // Mirror configuration is active
          }

          toast.loading(
            `Signing upload request with Nostr signer for ${providerName}...`,
            {
              id: TOAST_ID_BLOSSOM_AUTH,
            }
          );
          try {
            headers = await createBlossomAuthHeaders(
              providerInfo.provider as
                | "BLOSSOM_PRIMAL"
                | "BLOSSOM_BLOSSTR"
                | "BLOSSOM_SFS"
            );
            toast.success("Upload authorized!", { id: "blossom-auth" });
            setUploadProgress(60);
          } catch (authError: unknown) {
            const errorMessage =
              authError instanceof Error
                ? authError.message
                : String(authError);
            toast.error("Failed to authorize upload: " + errorMessage, {
              id: TOAST_ID_BLOSSOM_AUTH,
            });
            throw authError;
          }
        }

        setUploadProgress(70);

        // Get the action URL (default to current page)
        const actionUrl = options.action ?? window.location.pathname;

        // Make the request with custom headers for Blossom Primal
        const fetchResponse = await fetch(actionUrl, {
          method: options.method,
          body: formData,
          headers: {
            ...headers,
            // Don't set Content-Type for FormData, let the browser set it
          },
        });

        setUploadProgress(90);

        // ============================================================================
        // Helper Functions
        // ============================================================================

        async function parseErrorResponse(
          fetchResponse: Response
        ): Promise<{ error?: string }> {
          try {
            return (await fetchResponse.json()) as { error?: string };
          } catch {
            const errorText = await fetchResponse
              .text()
              .catch(() => `HTTP ${fetchResponse.status}`);
            return {
              error: errorText.includes("<!DOCTYPE")
                ? `HTTP ${fetchResponse.status}`
                : errorText,
            };
          }
        }

        function isHtmlResponse(responseText: string): boolean {
          return (
            responseText.includes("<!DOCTYPE") || responseText.includes("<html")
          );
        }

        function parseHtmlResponse(
          responseText: string,
          status: number
        ): Record<string, unknown> {
          if (
            responseText.includes("success") ||
            responseText.includes("uploaded") ||
            status === 200
          ) {
            return {
              success: true,
              redirect: true,
              message:
                "Upload completed, but received HTML response instead of JSON",
            };
          }
          return {
            success: false,
            error: "Server returned HTML instead of expected JSON response",
          };
        }

        async function parseResponse(
          fetchResponse: Response
        ): Promise<Record<string, unknown>> {
          const responseText = await fetchResponse.text();

          try {
            return JSON.parse(responseText) as Record<string, unknown>;
          } catch (parseError: unknown) {
            if (isHtmlResponse(responseText)) {
              return parseHtmlResponse(responseText, fetchResponse.status);
            }
            const error = parseError as Error;
            throw new Error(
              "Invalid response format: " +
                error.message +
                ". Response: " +
                responseText.substring(0, 100)
            );
          }
        }

        if (!fetchResponse.ok) {
          const errorData = await parseErrorResponse(fetchResponse);
          throw new Error(errorData.error ?? "Upload failed");
        }

        setUploadProgress(90);

        const result = await parseResponse(fetchResponse);

        setResponse(result);
        setUploadProgress(100);

        // Handle successful response
        if (result["success"] !== false) {
          // Check if this was a redirect response
          if (fetchResponse.redirected || result["redirect"]) {
            const redirectUrl = result["redirect"] ?? fetchResponse.url;
            navigate(redirectUrl);
          }
        }

        return result;
      } catch (error: unknown) {
        const { handleAsyncError } = await import("~/lib/error-handler.client");
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";
        handleAsyncError(error, {
          component: "useBlossomAwareUpload",
          action: "submitForm",
        });
        setError(errorMessage);
        throw error;
      } finally {
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
        }, 1000);
      }
    },
    [navigate]
  );

  return {
    submitForm,
    isUploading,
    uploadProgress,
    response,
    error,
  };
}
