/**
 * Server functions for engagement reply templates (CRUD).
 */

import {
  createReplyTemplate as createReplyTemplateRow,
  deleteReplyTemplateByIdAndUserId,
  findManyReplyTemplatesByUserId,
  updateReplyTemplateByIdAndUserId,
  type ReplyTemplateRecord as RepoReplyTemplateRecord,
} from "./repositories/engagement-reply-templates-data.server";

export type ReplyTemplateRecord = RepoReplyTemplateRecord;

export async function listReplyTemplates(
  userId: string
): Promise<ReplyTemplateRecord[]> {
  return findManyReplyTemplatesByUserId(userId);
}

export async function createReplyTemplate(
  userId: string,
  slug: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const s = slug.trim().toLowerCase().replace(/\s+/g, "-");
  if (!s) return { success: false, error: "Slug is required" };
  try {
    await createReplyTemplateRow(userId, s, body.trim());
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Failed to create template",
    };
  }
}

export async function deleteReplyTemplate(
  userId: string,
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const deleted = await deleteReplyTemplateByIdAndUserId(id, userId);
    return deleted ? { success: true } : { success: false, error: "Not found" };
  } catch {
    return { success: false, error: "Failed to delete template" };
  }
}

export async function updateReplyTemplate(
  userId: string,
  id: string,
  slug: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const s = slug.trim().toLowerCase().replace(/\s+/g, "-");
  if (!s) return { success: false, error: "Slug is required" };
  const b = body.trim();
  if (!b) return { success: false, error: "Body is required" };
  try {
    const updated = await updateReplyTemplateByIdAndUserId(id, userId, s, b);
    if (!updated) return { success: false, error: "Not found" };
    return { success: true };
  } catch (e) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      return {
        success: false,
        error: "A template with this slug already exists",
      };
    }
    return {
      success: false,
      error: e instanceof Error ? e.message : "Failed to update template",
    };
  }
}
