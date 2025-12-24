import { json } from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Ensure user is authenticated
    await requireUserId(request);

    const { relays, event } = await request.json();

    if (!event) {
      return json({ error: "Event is required" }, { status: 400 });
    }

    if (!relays || !Array.isArray(relays)) {
      return json({ error: "Relays array is required" }, { status: 400 });
    }

    // Publish to NOSTR_PUBLISHER_URL
    const publishResponse = await fetch(process.env.NOSTR_PUBLISHER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        relays,
        event,
      }),
    });

    if (!publishResponse.ok) {
      const errorText = await publishResponse.text();
      console.error("NOSTR_PUBLISHER_URL error:", errorText);
      throw new Error(`Failed to publish to nostr: ${publishResponse.status}`);
    }

    // Handle both JSON and text responses
    const contentType = publishResponse.headers.get("content-type");
    let result;

    if (contentType && contentType.includes("application/json")) {
      result = await publishResponse.json();
    } else {
      result = await publishResponse.text();
    }

    return json({
      success: true,
      message: "Event published successfully",
      result,
    });
  } catch (error) {
    console.error("Publish API error:", error);
    return json(
      {
        error: true,
        message: error.message || "Failed to publish event",
      },
      { status: 500 },
    );
  }
}
