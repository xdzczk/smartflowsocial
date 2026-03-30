/**
 * Templates action handlers
 * Centralized action processing for templates page
 */

import {
  deleteTemplate,
  updateTemplate,
} from "~/features/templates/services/template-data.server";
import {
  templatesActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";

import { duplicateTemplateForUser } from "./templates-duplicate.server";

const ACTION_DELETE = "delete";
const ACTION_BULK_DELETE = "bulkDelete";
const ACTION_RENAME = "rename";

export async function handleTemplatesAction(
  formData: FormData,
  userId: string
) {
  const result = validateFormDataOrRespond(formData, templatesActionSchema);
  if (!result.success) {
    return result.response;
  }

  const { _action } = result.data;

  if (_action === ACTION_DELETE) {
    const deleteData = result.data;
    await deleteTemplate({ id: deleteData.templateId, userId });
    return { success: true };
  }

  if (_action === ACTION_BULK_DELETE) {
    const ids = formData
      .getAll("templateIds")
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    for (const id of ids) {
      await deleteTemplate({ id, userId });
    }
    return { success: true };
  }

  if (_action === ACTION_RENAME) {
    const { templateId, name } = result.data;
    await updateTemplate({ id: templateId, userId, name: name.trim() });
    return { success: true };
  }

  const { templateId } = result.data;
  const dup = await duplicateTemplateForUser({ templateId, userId });
  if ("error" in dup && dup.error) {
    return { error: dup.error };
  }
  return { success: true };
}
