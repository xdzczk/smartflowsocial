import { Link, Outlet, useFetcher } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { getImageUrls } from "~/lib/helpers";

import { useTemplatesQuery, templatesKeys } from "../hooks/useTemplatesQuery";
import { useTemplatesState } from "../hooks/useTemplatesState";
import type { Template } from "../types";

import { TemplateDetailsModal } from "./TemplateDetailsModal";
import { TemplatesHeader } from "./TemplatesHeader";

function formatDate(template: Template): string {
  const d = template.createdAt;
  return d instanceof Date
    ? d.toLocaleDateString()
    : new Date(d).toLocaleDateString();
}

function typeLabel(template: Template): string {
  const t = (template as Template & { templateType?: string }).templateType;
  return t === "LONGFORM" ? "Article" : "Post";
}

/** Build modal payload with content from template post or longform */
function templateToModalPayload(
  t: Template & {
    post?: unknown;
    longFormPost?: unknown;
    templateType?: string;
  }
) {
  const createdAt =
    t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt);
  const base = {
    id: t.id,
    name: t.name ?? "",
    createdAt,
    templateType: t.templateType,
  };

  const post = t.post as
    | { caption?: string; content?: string; fileUrl?: string[] | string }
    | null
    | undefined;
  if (post && typeof post === "object" && t.templateType === "POST") {
    const fileUrl = Array.isArray(post.fileUrl)
      ? post.fileUrl
      : typeof post.fileUrl === "string"
        ? [post.fileUrl]
        : [];
    const imageUrl = getImageUrls(fileUrl)[0] ?? null;
    const text = (post.caption ?? post.content ?? "").trim() || null;
    return { ...base, text, imageUrl, summary: null };
  }

  const lf = t.longFormPost as
    | { title?: string; summary?: string; content?: string; image?: string }
    | null
    | undefined;
  if (lf && typeof lf === "object" && t.templateType === "LONGFORM") {
    const summary = (lf.summary ?? "").trim() || null;
    const content = (lf.content ?? "").trim() || null;
    const text = [summary, content].filter(Boolean).join("\n\n") || null;
    const imageUrl = (lf.image ?? "").trim() || null;
    return {
      ...base,
      text,
      imageUrl,
      summary: summary ?? null,
      longformTitle: (lf.title ?? "").trim() || null,
    };
  }

  return { ...base, text: null, imageUrl: null, summary: null };
}

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const { data } = useTemplatesQuery();
  const templates = Array.isArray(data?.templates) ? data.templates : [];
  const { selectedTemplate, setSelectedTemplate, isOnChildRoute } =
    useTemplatesState();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const bulkDeleteFetcher = useFetcher();
  const singleDeleteFetcher = useFetcher();

  useEffect(() => {
    if (
      bulkDeleteFetcher.state === "idle" &&
      bulkDeleteFetcher.data &&
      typeof bulkDeleteFetcher.data === "object" &&
      "success" in bulkDeleteFetcher.data &&
      (bulkDeleteFetcher.data as { success?: boolean }).success
    ) {
      void queryClient.invalidateQueries({ queryKey: templatesKeys.list() });
      queueMicrotask(() => setSelectedIds(new Set()));
    }
  }, [bulkDeleteFetcher.state, bulkDeleteFetcher.data, queryClient]);

  useEffect(() => {
    if (
      singleDeleteFetcher.state === "idle" &&
      singleDeleteFetcher.data &&
      typeof singleDeleteFetcher.data === "object" &&
      "success" in singleDeleteFetcher.data &&
      (singleDeleteFetcher.data as { success?: boolean }).success
    ) {
      void queryClient.invalidateQueries({ queryKey: templatesKeys.list() });
    }
  }, [singleDeleteFetcher.state, singleDeleteFetcher.data, queryClient]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      {!isOnChildRoute ? (
        <div className="p-6">
          <TemplatesHeader />
          <div className="rounded-md border">
            {templates.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 py-12 text-center">
                <p className="text-sm">No templates yet</p>
                <p className="text-xs">
                  Create a template from scratch to reuse in your composers.
                </p>
                <Button asChild variant="secondary">
                  <Link to="/dashboard/templates/new">Create template</Link>
                </Button>
              </div>
            ) : (
              <>
                {selectedIds.size > 0 ? (
                  <div className="border-border flex items-center gap-2 border-b px-4 py-2">
                    <bulkDeleteFetcher.Form method="post" key="bulk-delete">
                      <input type="hidden" name="_action" value="bulkDelete" />
                      {Array.from(selectedIds).map((id) => (
                        <input
                          key={id}
                          type="hidden"
                          name="templateIds"
                          value={id}
                        />
                      ))}
                      <Button
                        type="submit"
                        variant="destructive"
                        size="sm"
                        disabled={bulkDeleteFetcher.state !== "idle"}
                      >
                        {bulkDeleteFetcher.state !== "idle"
                          ? "Deleting..."
                          : "Delete selected"}
                      </Button>
                    </bulkDeleteFetcher.Form>
                    <span className="text-muted-foreground text-xs">
                      {selectedIds.size} selected
                    </span>
                  </div>
                ) : null}
                <ul className="divide-y">
                  {templates.map((template) => (
                    <li key={template.id} className="border-border divide-y">
                      <div
                        role="button"
                        tabIndex={0}
                        className="dark:hover:bg-muted hover:bg-muted flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors"
                        onClick={() =>
                          setSelectedTemplate(template as unknown as Template)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedTemplate(
                              template as unknown as Template
                            );
                          }
                        }}
                        aria-label={`View ${template.name ?? "template"}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(template.id)}
                          onChange={() => toggleSelection(template.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-gray-300"
                          aria-label={`Select ${template.name ?? "template"}`}
                        />
                        <span className="min-w-0 flex-1 font-medium">
                          {template.name ?? "Unnamed template"}
                        </span>
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {typeLabel(template as unknown as Template)}
                        </Badge>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {formatDate(template as unknown as Template)}
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5"
                            asChild
                          >
                            <Link
                              to={`/dashboard/templates/edit/${template.id}`}
                              aria-label="Edit template"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Pencil className="h-4 w-4" />
                              <span>Edit</span>
                            </Link>
                          </Button>
                          <singleDeleteFetcher.Form
                            method="post"
                            className="inline"
                          >
                            <input
                              type="hidden"
                              name="_action"
                              value="delete"
                            />
                            <input
                              type="hidden"
                              name="templateId"
                              value={template.id}
                            />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive h-8 w-8"
                              aria-label="Delete template"
                              disabled={singleDeleteFetcher.state !== "idle"}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </singleDeleteFetcher.Form>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {selectedTemplate ? (
            <TemplateDetailsModal
              template={templateToModalPayload(
                selectedTemplate as unknown as Template & {
                  post?: unknown;
                  longFormPost?: unknown;
                  templateType?: string;
                }
              )}
              onClose={() => setSelectedTemplate(null)}
              onDelete={(templateId) => {
                const formData = new FormData();
                formData.set("_action", "delete");
                formData.set("templateId", templateId);
                singleDeleteFetcher.submit(formData, { method: "post" });
                setSelectedTemplate(null);
              }}
              isDeleting={singleDeleteFetcher.state !== "idle"}
            />
          ) : null}
        </div>
      ) : null}
      <Outlet />
    </>
  );
}
