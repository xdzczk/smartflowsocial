import type { LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { loadChildrenData, handleChildrenApiError } from "~/features/user";

/**
 * Creates a loader function with dependency injection
 * This allows tests to inject mocks for both data loading and error handling
 */
function createLoader(
  dataLoader: (userId: string) => Promise<Response>,
  errorHandler: (error: unknown, requestUrl: string) => Response
) {
  return async ({ request }: LoaderFunctionArgs) => {
    try {
      const userId = await requireUserId(request);
      return await dataLoader(userId);
    } catch (error) {
      return errorHandler(error, request.url);
    }
  };
}

// Export the loader with the real dependencies
export const loader = createLoader(loadChildrenData, handleChildrenApiError);

// Export the factory for testing
export { createLoader };
