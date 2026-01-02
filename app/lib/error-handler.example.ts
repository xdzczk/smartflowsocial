/* eslint-disable no-console */
/**
 * Example Usage of Centralized Error Handling
 *
 * This file demonstrates how to use the error handling system
 * in your routes and features.
 */

import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";

import {
  withErrorHandling,
  withActionErrorHandling,
  handleLoaderError,
  handleActionError,
  createSuccessResponse,
  assert,
  assertExists,
  assertAuthenticated,
  assertAuthorized,
} from "./error-handler.server";
import {
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ExternalServiceError,
} from "./errors";

// ============================================================================
// Example 1: Using error handling wrapper (Recommended)
// ============================================================================

export const exampleLoader = withErrorHandling(
  async ({ request, params }: LoaderFunctionArgs) => {
    const userId = params.userId;
    assertExists(userId, "User ID is required");

    // Your loader logic here
    const data = { userId };
    return data;
  },
);

export const exampleAction = withActionErrorHandling(
  async ({ request, params }: ActionFunctionArgs) => {
    const formData = await request.formData();
    const name = formData.get("name");

    assert(typeof name === "string" && name.length > 0, "Name is required");

    // Your action logic here
    return createSuccessResponse({ name });
  },
);

// ============================================================================
// Example 2: Manual error handling in loaders
// ============================================================================

export async function manualLoaderExample({
  request,
  params,
}: LoaderFunctionArgs) {
  try {
    const userId = params.userId;
    assertExists(userId, "User ID is required");

    // Your loader logic here
    const data = { userId };
    return json(data);
  } catch (error) {
    return handleLoaderError(error, { userId: null, data: [] });
  }
}

// ============================================================================
// Example 3: Manual error handling in actions
// ============================================================================

export async function manualActionExample({
  request,
  params,
}: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const email = formData.get("email");

    // Validate input
    if (!email || typeof email !== "string") {
      throw new ValidationError("Email is required");
    }

    if (!email.includes("@")) {
      throw new ValidationError("Invalid email format", { email });
    }

    // Your action logic here
    return json(createSuccessResponse({ email }));
  } catch (error) {
    return handleActionError(error);
  }
}

// ============================================================================
// Example 4: Using assertion helpers
// ============================================================================

export async function assertionExample({
  request,
  params,
}: LoaderFunctionArgs) {
  const userId = await getUserId(request); // Your auth function
  assertAuthenticated(userId, "You must be logged in");

  const resource = await getResource(params.id);
  assertExists(resource, "Resource not found", { id: params.id ?? "" });

  const hasPermission = await checkPermission(userId, resource);
  const resourceId =
    resource &&
    typeof resource === "object" &&
    resource !== null &&
    "id" in resource
      ? String((resource as { id: unknown }).id)
      : "";
  assertAuthorized(
    hasPermission,
    "You don't have permission to access this resource",
    { userId, resourceId },
  );

  return json({ resource });
}

// ============================================================================
// Example 5: Throwing specific error types
// ============================================================================

export async function specificErrorsExample({
  request,
  params,
}: ActionFunctionArgs) {
  const userId = await getUserId(request);

  if (!userId) {
    throw new AuthenticationError("Please log in to continue");
  }

  const postId = params.postId;
  if (!postId) {
    throw new ValidationError("Post ID is required");
  }

  const post = await getPost(postId);
  if (!post) {
    throw new NotFoundError("Post not found", { postId });
  }

  const postUserId =
    post && typeof post === "object" && post !== null && "userId" in post
      ? (post as { userId: unknown }).userId
      : undefined;
  if (postUserId && typeof postUserId === "string" && postUserId !== userId) {
    throw new AuthorizationError(
      "You don't have permission to edit this post",
      { postId, userId },
    );
  }

  // Your logic here
  return json(createSuccessResponse({ post }));
}

// ============================================================================
// Example 6: Handling external service errors
// ============================================================================

export async function externalServiceExample({ request }: ActionFunctionArgs) {
  try {
    const response = await fetch("https://api.example.com/data");
    if (!response.ok) {
      throw new ExternalServiceError(
        "Failed to fetch data from external service",
        response.status,
        { status: response.status, statusText: response.statusText },
      );
    }
    const data = await response.json();
    return json(createSuccessResponse(data));
  } catch (error) {
    if (error instanceof ExternalServiceError) {
      throw error; // Re-throw our custom error
    }
    // Wrap unknown errors
    throw new ExternalServiceError(
      "Unexpected error calling external service",
      502,
      { originalError: error instanceof Error ? error.message : String(error) },
    );
  }
}

// ============================================================================
// Helper functions (these would be in your actual codebase)
// ============================================================================

async function getUserId(request: Request): Promise<string | null> {
  // Your auth logic
  return null;
}

async function getResource(id: string | undefined) {
  // Your database logic
  return null;
}

async function checkPermission(userId: string, resource: unknown) {
  // Your permission logic
  return false;
}

async function getPost(postId: string) {
  // Your database logic
  return null;
}
