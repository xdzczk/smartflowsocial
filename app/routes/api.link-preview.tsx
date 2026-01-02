import { json, type LoaderFunctionArgs } from "@remix-run/node";

import {
  ValidationError,
  ExternalServiceError,
} from "~/lib/errors";

type AssertFunction = (condition: boolean, message: string, context?: Record<string, unknown>) => asserts condition;

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const errorHandler = await import("~/lib/error-handler.server");
    const assert: AssertFunction = errorHandler.assert;
    
    const url = new URL(request.url);
    const targetUrlParam = url.searchParams.get("url");

    assert(targetUrlParam !== null, "URL parameter is required", {
      searchParams: Array.from(url.searchParams.entries()),
    });

    const targetUrl = targetUrlParam;

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
      ) || // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR for trying multiple regex patterns
      html.match(
        /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i,
      );
    const imageMatch =
      html.match(
        /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      ) || // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR for trying multiple regex patterns
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
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { createErrorResponse } = await import("~/lib/error-handler.server");
    const [errorResponse, statusCode] = createErrorResponse(error);
    return json({ success: false, error: errorResponse.error }, { status: statusCode });
  }
}
