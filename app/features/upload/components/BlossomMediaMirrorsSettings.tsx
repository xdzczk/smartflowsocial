import { useFetcher, useRevalidator } from "@remix-run/react";
import { Plus, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ManagementListSection } from "~/features/settings/components/patterns";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import { clearUploadProviderCache } from "~/lib/query";
import { updateBlossomMirrorsClientSchema } from "~/lib/validation";
import { useZodFieldArray } from "~/lib/validation/hooks/useZodFieldArray";
import {
  useZodForm,
  formDataToFormData,
} from "~/lib/validation/utils.client-safe";

interface BlossomMediaMirrorsSettingsProps {
  enableMirrorBlossom: boolean;
  mirrorUploadUrls: string[];
}

function cleanMirrorUrl(url: string): string {
  const cleanedUrl = url.trim();
  return cleanedUrl.endsWith("/") ? cleanedUrl.slice(0, -1) : cleanedUrl;
}

function normalizeMirrorUrlList(urls: string[]): string[] {
  return urls.map((u) => cleanMirrorUrl(u.trim())).filter((u) => u.length > 0);
}

export function BlossomMediaMirrorsSettings({
  enableMirrorBlossom,
  mirrorUploadUrls,
}: BlossomMediaMirrorsSettingsProps) {
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();
  const revalidator = useRevalidator();

  const form = useZodForm(updateBlossomMirrorsClientSchema, {
    defaultValues: {
      enableMirrorBlossom,
      mirrorUrls: mirrorUploadUrls.length > 0 ? mirrorUploadUrls : [""],
    },
  });

  const { fields, append, remove } = useZodFieldArray<
    z.infer<typeof updateBlossomMirrorsClientSchema>,
    "mirrorUrls"
  >(
    form as unknown as UseFormReturn<
      z.infer<typeof updateBlossomMirrorsClientSchema>
    >,
    "mirrorUrls"
  );

  const isSubmitting = fetcher.state === "submitting";
  const watchedMirrorUrls = form.watch("mirrorUrls");
  const watchedEnableMirror = form.watch("enableMirrorBlossom");

  useEffect(() => {
    form.reset({
      enableMirrorBlossom,
      mirrorUrls: mirrorUploadUrls.length > 0 ? mirrorUploadUrls : [""],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when server props change
  }, [enableMirrorBlossom, mirrorUploadUrls]);

  const validateUrl = (url: string) => {
    const cleanedUrl = url.trim();
    if (!cleanedUrl.startsWith("https://")) {
      return false;
    }
    try {
      new URL(cleanedUrl);
      return true;
    } catch {
      return false;
    }
  };

  const persistMirrors = (enable: boolean, urls: string[]) => {
    const filtered = urls.filter((url: string) => url.trim());
    const invalidUrls = filtered.filter(
      (url: string) => !validateUrl(url.trim())
    );
    if (invalidUrls.length > 0) {
      form.setError("mirrorUrls", {
        type: "manual",
        message: "All URLs must start with https:// and be valid URLs",
      });
      return;
    }
    const cleanedUrls = filtered.map((url) => cleanMirrorUrl(url));
    const formData = formDataToFormData(
      {
        enableMirrorBlossom: enable,
        mirrorUrls: cleanedUrls.join("\n"),
      },
      "update_blossom_mirrors"
    );
    fetcher.submit(formData, { method: "post" });
  };

  const urlsDirty = useMemo(() => {
    if (!watchedEnableMirror) return false;
    return (
      JSON.stringify(normalizeMirrorUrlList(watchedMirrorUrls)) !==
      JSON.stringify(normalizeMirrorUrlList(mirrorUploadUrls))
    );
  }, [watchedEnableMirror, watchedMirrorUrls, mirrorUploadUrls]);

  const hasValidationErrors = watchedMirrorUrls.some(
    (url) => url.trim() && !validateUrl(url.trim())
  );

  const onSaveUrls = () => {
    persistMirrors(watchedEnableMirror, watchedMirrorUrls);
  };

  useEffect(() => {
    if (fetcher.state !== "idle") return;
    if (fetcher.data?.success) {
      clearUploadProviderCache();
      revalidator.revalidate();
    }
  }, [fetcher.state, fetcher.data, revalidator]);

  return (
    <ManagementListSection
      title="Blossom media mirrors"
      description="Add redundancy by mirroring uploads to additional Blossom servers. Applies when your upload provider is a Blossom option."
    >
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="enableMirrorBlossom"
            checked={watchedEnableMirror}
            onCheckedChange={(checked) => {
              const next = checked as boolean;
              if (next) {
                const urls = form.getValues("mirrorUrls");
                const invalid = urls.some(
                  (u) => u.trim() && !validateUrl(u.trim())
                );
                if (invalid) {
                  form.setError("mirrorUrls", {
                    type: "manual",
                    message:
                      "Fix invalid mirror URLs before enabling, or clear the fields.",
                  });
                  return;
                }
              }
              form.setValue("enableMirrorBlossom", next);
              form.clearErrors("mirrorUrls");
              persistMirrors(next, form.getValues("mirrorUrls"));
            }}
            disabled={isSubmitting}
          />
          <Label
            htmlFor="enableMirrorBlossom"
            className="cursor-pointer text-sm font-normal"
          >
            Enable Blossom media mirrors
          </Label>
        </div>

        {watchedEnableMirror ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Label className="text-foreground">Mirror URLs</Label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onSaveUrls()}
                disabled={isSubmitting || !urlsDirty || hasValidationErrors}
              >
                {isSubmitting ? "Saving…" : "Save mirror URLs"}
              </Button>
            </div>
            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <Input
                    id={`mirror-url-${index}`}
                    {...form.register(`mirrorUrls.${index}`)}
                    placeholder="https://blossom.example.com"
                    disabled={isSubmitting}
                    onBlur={() => {
                      const value = form.getValues(`mirrorUrls.${index}`);
                      if (value.trim() && !validateUrl(value.trim())) {
                        form.setError(`mirrorUrls.${index}`, {
                          type: "manual",
                          message:
                            "Must start with https:// and be a valid URL",
                        });
                      } else {
                        form.clearErrors(`mirrorUrls.${index}`);
                      }
                    }}
                    className={
                      form.formState.errors.mirrorUrls?.[index]
                        ? "border-destructive"
                        : ""
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      remove(index);
                      form.clearErrors("mirrorUrls");
                    }}
                    disabled={isSubmitting}
                  >
                    <X className={INLINE_ICON_SIZE_CLASS} />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append("")}
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                <Plus className={`mr-2 ${INLINE_ICON_SIZE_CLASS}`} />
                Add mirror URL
              </Button>
            </div>
            {form.formState.errors.mirrorUrls ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.mirrorUrls.message ??
                  "Please fix validation errors"}
              </p>
            ) : null}
            <p className="text-muted-foreground text-xs">
              HTTPS only. Save after editing the list.
            </p>
          </div>
        ) : null}

        {fetcher.data?.success ? (
          <p className="text-success text-sm">Mirror settings updated.</p>
        ) : null}
        {fetcher.data?.error ? (
          <p className="text-destructive text-sm">{fetcher.data.error}</p>
        ) : null}
      </div>
    </ManagementListSection>
  );
}
