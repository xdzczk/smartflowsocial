import { Link, Outlet, useFetcher, useSearchParams } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, FileText, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  AttachmentCountChip,
  PublishingContentTypeFilter,
  PublishingEmptyState,
  PublishingFilterRow,
  PublishingLibraryShell,
  PublishingPageHeader,
  PUBLISHING_FILTER_SELECT_TRIGGER_CLASS,
  PUBLISHING_TEMPLATE_TYPE_SELECT_TRIGGER_CLASS,
  TemplateKindChip,
  TextOnlyIndicatorChip,
} from "~/features/posts/ui";
import { getImageUrls } from "~/lib/helpers";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";

import { useTemplatesQuery, templatesKeys } from "../hooks/useTemplatesQuery";
import { useTemplatesState } from "../hooks/useTemplatesState";
import type { Template } from "../types";

import { CreateTemplateTypeDialog } from "./CreateTemplateTypeDialog";

type TemplateFilter = "all" | "POST" | "LONGFORM";
type TemplateSort = "updated" | "name";

function typeLabel(template: Template & { templateType?: string }): string {
  const t = template.templateType;
  return t === "LONGFORM" ? "Article" : "Post";
}

function formatTemplateUpdated(template: Template, dateLocale: string): string {
  const d = template.updatedAt;
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString(dateLocale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Modal/sheet payload with content from template post or longform */
function templateToDetailPayload(
  t: Template & {
    post?: unknown;
    longFormPost?: unknown;
    templateType?: string;
  }
) {
  const createdAt =
    t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt);
  const updatedAtRaw = (t as { updatedAt?: string | Date }).updatedAt;
  const updatedAt =
    updatedAtRaw != null
      ? updatedAtRaw instanceof Date
        ? updatedAtRaw
        : new Date(updatedAtRaw)
      : createdAt;
  const base = {
    id: t.id,
    name: t.name ?? "",
    createdAt,
    updatedAt,
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
    return {
      ...base,
      text,
      imageUrl,
      summary: null,
      mediaCount: fileUrl.filter(Boolean).length,
    };
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
      mediaCount: imageUrl ? 1 : 0,
    };
  }

  return {
    ...base,
    text: null,
    imageUrl: null,
    summary: null,
    mediaCount: 0,
  };
}

function previewSnippet(
  t: Template & {
    post?: unknown;
    longFormPost?: unknown;
    templateType?: string;
  }
): string {
  const p = templateToDetailPayload(t);
  if (p.text && p.text.length > 0) {
    const oneLine = p.text.replace(/\s+/g, " ").trim();
    return oneLine.length > 140 ? `${oneLine.slice(0, 140)}…` : oneLine;
  }
  return "No preview yet";
}

export default function TemplatesPage() {
  const { dateLocale, formatDate } = useFormattedDate();
  const queryClient = useQueryClient();
  const { data } = useTemplatesQuery();
  const { isOnChildRoute } = useTemplatesState();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TemplateFilter>("all");
  const [sort, setSort] = useState<TemplateSort>("updated");
  const [sheetTemplate, setSheetTemplate] = useState<Template | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Template | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const actionFetcher = useFetcher<{
    success?: boolean;
    error?: string;
  }>();

  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    queueMicrotask(() => {
      setCreateOpen(true);
    });
    searchParams.delete("create");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (
      actionFetcher.state === "idle" &&
      actionFetcher.data &&
      typeof actionFetcher.data === "object" &&
      "success" in actionFetcher.data &&
      (actionFetcher.data as { success?: boolean }).success
    ) {
      void queryClient.invalidateQueries({ queryKey: templatesKeys.list() });
      queueMicrotask(() => {
        setRenameOpen(false);
        setRenameTarget(null);
      });
    }
  }, [actionFetcher.state, actionFetcher.data, queryClient]);

  const rawTemplatesCount = useMemo(
    () => (Array.isArray(data?.templates) ? data.templates.length : 0),
    [data?.templates]
  );

  const templates = useMemo(() => {
    const templatesRaw = Array.isArray(data?.templates) ? data.templates : [];
    let list = templatesRaw as unknown as Template[];
    if (typeFilter !== "all") {
      list = list.filter(
        (x) => (x as { templateType?: string }).templateType === typeFilter
      );
    }
    const sorted = [...list];
    if (sort === "name") {
      sorted.sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "", undefined, {
          sensitivity: "base",
        })
      );
    } else {
      sorted.sort((a, b) => {
        const ra = a as {
          updatedAt?: string | Date;
          createdAt?: string | Date;
        };
        const rb = b as {
          updatedAt?: string | Date;
          createdAt?: string | Date;
        };
        const ta = new Date(ra.updatedAt ?? ra.createdAt ?? 0).getTime();
        const tb = new Date(rb.updatedAt ?? rb.createdAt ?? 0).getTime();
        return tb - ta;
      });
    }
    return sorted;
  }, [data, typeFilter, sort]);

  const submitAction = (formData: FormData) => {
    actionFetcher.submit(formData, { method: "post" });
  };

  const detail = sheetTemplate
    ? templateToDetailPayload(sheetTemplate as never)
    : null;
  const useHref =
    detail &&
    (detail.templateType === "LONGFORM"
      ? `/dashboard/compose?type=article&templateId=${encodeURIComponent(detail.id)}`
      : `/dashboard/compose?type=post&templateId=${encodeURIComponent(detail.id)}`);

  return (
    <>
      {!isOnChildRoute ? (
        <PublishingLibraryShell>
          <div className="pt-2 pb-4">
            <PublishingPageHeader
              title="Templates"
              subtitle="Reusable blueprints for posts, articles, and publishing workflows."
              actions={
                <Button
                  type="button"
                  className="h-9 shrink-0 px-4"
                  onClick={() => setCreateOpen(true)}
                >
                  Create template
                </Button>
              }
            />
          </div>

          <PublishingFilterRow
            leading={
              <PublishingContentTypeFilter
                data-testid="templates-type-segments"
                value={typeFilter}
                ariaLabel="Template type"
                triggerClassName={PUBLISHING_TEMPLATE_TYPE_SELECT_TRIGGER_CLASS}
                onValueChange={(v) => setTypeFilter(v as TemplateFilter)}
                items={[
                  {
                    id: "all",
                    to: "",
                    triggerLabel: "All types",
                    menuLabel: "All types",
                    ariaLabel: "All templates",
                  },
                  {
                    id: "POST",
                    to: "",
                    triggerLabel: "Post",
                    menuLabel: "Post",
                    ariaLabel: "Post templates",
                  },
                  {
                    id: "LONGFORM",
                    to: "",
                    triggerLabel: "Article",
                    menuLabel: "Article",
                    ariaLabel: "Article templates",
                  },
                ]}
              />
            }
            trailing={
              <Select
                value={sort}
                onValueChange={(v) => setSort(v as TemplateSort)}
              >
                <SelectTrigger
                  className={PUBLISHING_FILTER_SELECT_TRIGGER_CLASS}
                  aria-label="Sort templates"
                >
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated">Recently updated</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
            }
          />

          <CreateTemplateTypeDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
          />

          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {rawTemplatesCount === 0 ? (
              <div className="border-border bg-card rounded-xl border">
                <PublishingEmptyState
                  data-testid="empty-state"
                  icon={<FileText strokeWidth={1.25} aria-hidden />}
                  title="No templates yet"
                  description="Save reusable blueprints for recurring posts and articles. Speed up weekly posts, announcements, and article structures."
                >
                  <Button type="button" onClick={() => setCreateOpen(true)}>
                    Create template
                  </Button>
                </PublishingEmptyState>
              </div>
            ) : templates.length === 0 ? (
              <div className="border-border bg-card rounded-xl border">
                <PublishingEmptyState
                  data-testid="templates-filtered-empty"
                  title="No templates match these filters"
                  description="Try another type or clear filters to see all templates."
                >
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setTypeFilter("all")}
                  >
                    Clear filters
                  </Button>
                </PublishingEmptyState>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {templates.map((template) => {
                  const t = template as Template & {
                    post?: unknown;
                    longFormPost?: unknown;
                    templateType?: string;
                  };
                  const id = t.id;
                  const rowUseHref =
                    t.templateType === "LONGFORM"
                      ? `/dashboard/compose?type=article&templateId=${encodeURIComponent(id)}`
                      : `/dashboard/compose?type=post&templateId=${encodeURIComponent(id)}`;
                  const payload = templateToDetailPayload(t);
                  const mediaCount = payload.mediaCount;
                  const thumb = payload.imageUrl;
                  const displayName = t.name ?? "Unnamed template";

                  const handleCardKeyDown = (
                    e: KeyboardEvent<HTMLDivElement>
                  ) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSheetTemplate(template);
                    }
                  };

                  return (
                    <li key={id}>
                      <div
                        className="border-border bg-card hover:border-border/80 hover:bg-muted/30 focus-visible:ring-ring cursor-pointer rounded-xl border p-4 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        role="button"
                        tabIndex={0}
                        aria-label={`Template: ${displayName}`}
                        onClick={() => setSheetTemplate(template)}
                        onKeyDown={handleCardKeyDown}
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-5">
                          <div className="shrink-0">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt=""
                                className="border-border/60 size-14 rounded-lg border object-cover sm:size-16"
                              />
                            ) : (
                              <div
                                className="border-border/40 bg-muted/30 size-14 rounded-lg border border-dashed sm:size-16"
                                aria-hidden
                              />
                            )}
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <div className="space-y-1 text-left">
                              <h3 className="text-foreground text-base font-semibold tracking-tight">
                                {displayName}
                              </h3>
                              <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
                                {previewSnippet(t)}
                              </p>
                            </div>
                            <div className="mt-3 flex min-h-[1.75rem] flex-wrap items-center gap-2">
                              <TemplateKindChip label={typeLabel(t)} />
                              {mediaCount > 0 ? (
                                <AttachmentCountChip count={mediaCount} />
                              ) : (
                                <TextOnlyIndicatorChip />
                              )}
                              <span className="text-muted-foreground text-xs sm:hidden">
                                {formatTemplateUpdated(t as never, dateLocale)}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col gap-2 sm:min-w-[12rem] sm:items-end">
                            <span className="text-muted-foreground hidden text-xs tabular-nums sm:block sm:text-right">
                              {formatTemplateUpdated(t as never, dateLocale)}
                            </span>
                            <div
                              role="toolbar"
                              aria-label="Template actions"
                              tabIndex={-1}
                              className="flex flex-wrap items-center justify-end gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            >
                              <Button
                                size="sm"
                                className="h-9 gap-1.5 px-3"
                                asChild
                              >
                                <Link to={rowUseHref}>Use template</Link>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 gap-1.5 px-3"
                                asChild
                              >
                                <Link
                                  to={`/dashboard/templates/edit/${id}`}
                                  className="gap-1.5"
                                >
                                  <Pencil
                                    className="h-3.5 w-3.5"
                                    strokeWidth={INLINE_ICON_STROKE}
                                    aria-hidden
                                  />
                                  Edit template
                                </Link>
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 shrink-0"
                                    aria-label="More actions"
                                  >
                                    <MoreHorizontal
                                      className="h-4 w-4"
                                      aria-hidden
                                    />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      const fd = new FormData();
                                      fd.set("_action", "duplicate");
                                      fd.set("templateId", id);
                                      submitAction(fd);
                                    }}
                                  >
                                    <Copy
                                      className="mr-2 h-4 w-4"
                                      aria-hidden
                                    />
                                    Duplicate
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setRenameTarget(template);
                                      setRenameValue(t.name ?? "");
                                      setRenameOpen(true);
                                    }}
                                  >
                                    <Pencil
                                      className="mr-2 h-4 w-4"
                                      aria-hidden
                                    />
                                    Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => {
                                      const fd = new FormData();
                                      fd.set("_action", "delete");
                                      fd.set("templateId", id);
                                      submitAction(fd);
                                    }}
                                  >
                                    <Trash2
                                      className="mr-2 h-4 w-4"
                                      aria-hidden
                                    />
                                    Delete template
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Sheet
            open={sheetTemplate !== null}
            onOpenChange={(o) => {
              if (!o) setSheetTemplate(null);
            }}
          >
            <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
              {detail ? (
                <>
                  <SheetHeader className="space-y-1 text-left">
                    <SheetTitle className="pr-8">
                      {detail.name || "Unnamed template"}
                    </SheetTitle>
                    <div className="flex flex-wrap gap-2">
                      <TemplateKindChip
                        label={
                          detail.templateType === "LONGFORM"
                            ? "Article"
                            : "Post"
                        }
                      />
                      <span className="text-muted-foreground text-xs">
                        Updated {formatDate(detail.updatedAt)}
                      </span>
                    </div>
                  </SheetHeader>
                  <div className="flex flex-1 flex-col gap-4 py-4">
                    {"longformTitle" in detail &&
                    detail.longformTitle &&
                    detail.longformTitle !== detail.name ? (
                      <p className="text-muted-foreground text-sm">
                        Article title: {detail.longformTitle}
                      </p>
                    ) : null}
                    {detail.imageUrl ? (
                      <img
                        src={detail.imageUrl}
                        alt=""
                        className="max-h-48 w-full rounded-lg object-cover"
                      />
                    ) : null}
                    {detail.text ? (
                      <div>
                        <p className="mb-1 text-xs font-medium">Preview</p>
                        <p className="text-muted-foreground max-h-56 overflow-y-auto text-sm whitespace-pre-wrap">
                          {detail.text}
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        No body text yet.
                      </p>
                    )}
                    <div className="mt-auto flex flex-col gap-2 border-t pt-4">
                      <Button className="w-full gap-2" asChild>
                        <Link
                          to={useHref ?? "#"}
                          onClick={() => setSheetTemplate(null)}
                        >
                          <FileText className="h-4 w-4" aria-hidden />
                          Use template
                        </Link>
                      </Button>
                      <Button variant="outline" className="w-full" asChild>
                        <Link
                          to={`/dashboard/templates/edit/${detail.id}`}
                          onClick={() => setSheetTemplate(null)}
                        >
                          Edit template
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-destructive hover:text-destructive w-full"
                        onClick={() => {
                          const fd = new FormData();
                          fd.set("_action", "delete");
                          fd.set("templateId", detail.id);
                          submitAction(fd);
                          setSheetTemplate(null);
                        }}
                      >
                        Delete template
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </SheetContent>
          </Sheet>

          <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rename template</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="rename-template">Name</Label>
                <Input
                  id="rename-template"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  placeholder="Template name"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRenameOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={
                    !renameValue.trim() || actionFetcher.state !== "idle"
                  }
                  onClick={() => {
                    if (!renameTarget) return;
                    const fd = new FormData();
                    fd.set("_action", "rename");
                    fd.set("templateId", renameTarget.id);
                    fd.set("name", renameValue.trim());
                    submitAction(fd);
                  }}
                >
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PublishingLibraryShell>
      ) : null}
      <Outlet />
    </>
  );
}
