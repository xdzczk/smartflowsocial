import { useNavigate } from "@remix-run/react";
import { useState, useCallback } from "react";
import { toast } from "react-hot-toast";
interface UploadProvider {
  provider: "S3" | "BLOSSOM_PRIMAL" | "BLOSSOM_BLOSSTR";
  isUsingBlossom: boolean;
  enableMirrorBlossom?: boolean;
  mirrorUploadUrls?: string[];
}

interface SubmitOptions {
  method: string;
  encType?: string;
  action?: string;
}

export function useBlossomAwareUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [response, setResponse] = useState<Record<string, unknown> | null>(null);
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
      return {
        provider: "S3",
        isUsingBlossom: false,
        enableMirrorBlossom: false,
        mirrorUploadUrls: [],
      };
    } catch (error) {
      console.error("Failed to check upload provider:", error);
      return {
        provider: "S3",
        isUsingBlossom: false,
        enableMirrorBlossom: false,
        mirrorUploadUrls: [],
      };
    }
  };

  const createBlossomAuthHeaders = async (
    provider: "BLOSSOM_PRIMAL" | "BLOSSOM_BLOSSTR",
  ) => {
    if (!window.nostr) {
      throw new Error(
        "NOSTR extension not found. Please install Alby, Amber, or another NOSTR extension to upload to Blossom.",
      );
    }

    let _uploadUrl: string;
    if (provider === "BLOSSOM_PRIMAL") {
      _uploadUrl = "https://blossom.primal.net/upload";
    } else if (provider === "BLOSSOM_BLOSSTR") {
      _uploadUrl = "https://blosstr.com/upload";
    } else {
      throw new Error("Invalid blossom provider");
    }

    // Note: Authentication should be handled by the upload service directly
    throw new Error(
      "Blossom auth not implemented in useBlossomAwareUpload. Use upload.client.ts instead.",
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
            providerInfo.provider === "BLOSSOM_PRIMAL" ? "Primal" : "Blosstr";

          // Log mirror configuration if enabled
          if (
            providerInfo.enableMirrorBlossom &&
            providerInfo.mirrorUploadUrls?.length
          ) {
            // Mirror configuration is active
          }

          toast.loading(
            `Signing upload request with NOSTR extension for ${providerName}...`,
            {
              id: "blossom-auth",
            },
          );
          try {
            headers = await createBlossomAuthHeaders(
              providerInfo.provider as "BLOSSOM_PRIMAL" | "BLOSSOM_BLOSSTR",
            );
            toast.success("Upload authorized!", { id: "blossom-auth" });
            setUploadProgress(60);
          } catch (authError: unknown) {
            const errorMessage = authError instanceof Error ? authError.message : String(authError);
            toast.error("Failed to authorize upload: " + errorMessage, {
              id: "blossom-auth",
            });
            throw authError;
          }
        }

        setUploadProgress(70);

        // Get the action URL (default to current page)
        const actionUrl = options.action || window.location.pathname;

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

        if (!fetchResponse.ok) {
          let errorData: { error?: string };
          try {
            errorData = (await fetchResponse.json()) as { error?: string };
          } catch {
            // If response is not JSON, try to get text
            const errorText = await fetchResponse
              .text()
              .catch(() => `HTTP ${fetchResponse.status}`);
            errorData = {
              error: errorText.includes("<!DOCTYPE")
                ? `HTTP ${fetchResponse.status}`
                : errorText,
            };
          }
          throw new Error(errorData.error || "Upload failed");
        }

        let result;
        const responseText = await fetchResponse.text();

        try {
          // Try to parse as JSON first
          result = JSON.parse(responseText) as Record<string, unknown>;
        } catch (_parseError: unknown) {
          // If response is HTML (redirect or error page), handle gracefully
          if (
            responseText.includes("<!DOCTYPE") ||
            responseText.includes("<html")
          ) {
            if (
              responseText.includes("success") ||
              responseText.includes("uploaded") ||
              fetchResponse.status === 200
            ) {
              result = {
                success: true,
                redirect: true,
                message:
                  "Upload completed, but received HTML response instead of JSON",
              };
            } else {
              result = {
                success: false,
                error: "Server returned HTML instead of expected JSON response",
              };
            }
          } else {
            const parseError = _parseError as Error;
            throw new Error(
              "Invalid response format: " +
              (parseError?.message ?? "Unknown error") +
              ". Response: " +
              responseText.substring(0, 100),
            );
          }
        }

        setResponse(result);
        setUploadProgress(100);

        // Handle successful response
        if (result.success !== false) {
          // Check if this was a redirect response
          if (fetchResponse.redirected || result.redirect) {
            const redirectUrl = result.redirect || fetchResponse.url;
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
    [navigate],
  );

  return {
    submitForm,
    isUploading,
    uploadProgress,
    response,
    error,
  };
}
