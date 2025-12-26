import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import {
  withErrorHandling,
  assert,
} from "~/lib/error-handler.server";
import {
  ValidationError,
  ExternalServiceError,
} from "~/lib/errors";

export const loader = withErrorHandling(
  async ({ request }: LoaderFunctionArgs) => {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    assert(targetUrl !== null, "URL parameter is required", {
      searchParams: Array.from(url.searchParams.entries()),
    });

    // Validate URL format
    try {
      new URL(targetUrl);
    } catch {
      throw new ValidationError("Invalid URL format", { targetUrl });
    }

    assert(
      targetUrl.startsWith("http://") || targetUrl.startsWith("https://"),
      "URL must start with http:// or https://",
      { targetUrl },
    );

    // Fetch the URL
    let response: Response;
    try {
      response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LinkPreview/1.0)",
        },
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      throw new ExternalServiceError(
        "Failed to fetch URL",
        502,
        {
          service: "LinkPreview",
          targetUrl,
          originalError: error instanceof Error ? error.message : String(error),
        },
      );
    }

    if (!response.ok) {
      throw new ExternalServiceError(
        `Failed to fetch URL: HTTP ${response.status}`,
        response.status >= 500 ? 502 : response.status,
        {
          service: "LinkPreview",
          targetUrl,
          status: response.status,
          statusText: response.statusText,
        },
      );
    }

    let html: string;
    try {
      html = await response.text();
    } catch (error) {
      throw new ExternalServiceError(
        "Failed to read response from URL",
        502,
        {
          service: "LinkPreview",
          targetUrl,
          originalError: error instanceof Error ? error.message : String(error),
        },
      );
    }

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descriptionMatch =
      html.match(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      ) ||
      html.match(
        /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i,
      );
    const imageMatch =
      html.match(
        /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      ) ||
      html.match(
        /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i,
      );

    const title = titleMatch ? titleMatch[1].trim() : "";
    const description = descriptionMatch ? descriptionMatch[1].trim() : "";
    const image = imageMatch ? imageMatch[1].trim() : "";

    return {
      success: 1,
      meta: {
        title,
        description,
        image: {
          url: image,
        },
      },
    };
  },
);
