import { Link, Outlet, useFetcher } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

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
                    <li
                      key={template.id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(template.id)}
                        onChange={() => toggleSelection(template.id)}
                        className="rounded border-gray-300"
                        aria-label={`Select ${template.name ?? "template"}`}
                      />
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left font-medium hover:underline"
                        onClick={() =>
                          setSelectedTemplate(template as unknown as Template)
                        }
                      >
                        {template.name ?? "Unnamed template"}
                      </button>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {typeLabel(template as unknown as Template)}
                      </Badge>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {formatDate(template as unknown as Template)}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          asChild
                        >
                          <Link
                            to={`/dashboard/templates/edit/${template.id}`}
                            aria-label="Edit template"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <singleDeleteFetcher.Form
                          method="post"
                          className="inline"
                        >
                          <input type="hidden" name="_action" value="delete" />
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
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </singleDeleteFetcher.Form>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {selectedTemplate ? (
            <TemplateDetailsModal
              template={(() => {
                const t = selectedTemplate as unknown as Template;
                return {
                  id: t.id,
                  name: t.name ?? "",
                  text: null,
                  imageUrl: null,
                  createdAt:
                    t.createdAt instanceof Date
                      ? t.createdAt
                      : new Date(t.createdAt),
                };
              })()}
              onClose={() => setSelectedTemplate(null)}
            />
          ) : null}
        </div>
      ) : null}
      <Outlet />
    </>
  );
}
