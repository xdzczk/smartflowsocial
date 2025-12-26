/**
 * Hashtag preset action handlers
 */

import { json } from "@remix-run/node";
import {
  createHashTagPreset,
  updateHashTagPreset,
  deleteHashTagPreset,
} from "~/models/user.server";

export async function handleHashtagPresetAction(
  userId: string,
  action: string,
  formData: FormData,
) {
  if (action === "create_hashtag_preset") {
    const name = formData.get("name") as string;
    const tags = formData.get("tags") as string;
    const description = formData.get("description") as string;

    if (!name.trim() || !tags.trim()) {
      return json({ error: "Name and tags are required" }, { status: 400 });
    }

    await createHashTagPreset(userId, name, tags, description || undefined);
    return json({ success: true });
  }

  if (action === "update_hashtag_preset") {
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const tags = formData.get("tags") as string;
    const description = formData.get("description") as string;

    if (!id || !name.trim() || !tags.trim()) {
      return json(
        { error: "ID, name and tags are required" },
        { status: 400 },
      );
    }

    await updateHashTagPreset(
      userId,
      id,
      name,
      tags,
      description || undefined,
    );
    return json({ success: true });
  }

  if (action === "delete_hashtag_preset") {
    const id = formData.get("id") as string;

    if (!id) {
      return json({ error: "ID is required" }, { status: 400 });
    }

    await deleteHashTagPreset(userId, id);
    return json({ success: true });
  }

  return null;
}


