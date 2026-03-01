import { json, type LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { getUserPrimarySignerProfile } from "~/features/user";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const primarySignerProfile = await getUserPrimarySignerProfile(userId);
    return json({ primarySignerProfile });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, { primarySignerProfile: null });
  }
}
