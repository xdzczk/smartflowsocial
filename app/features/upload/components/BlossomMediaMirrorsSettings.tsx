import { useFetcher } from "@remix-run/react";
import { Plus, X } from "lucide-react";
import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
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

export function BlossomMediaMirrorsSettings({
  enableMirrorBlossom,
  mirrorUploadUrls,
}: BlossomMediaMirrorsSettingsProps) {
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();
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
  const hasChanged =
    watchedEnableMirror !== enableMirrorBlossom ||
    JSON.stringify(watchedMirrorUrls) !== JSON.stringify(mirrorUploadUrls);

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

  const cleanUrl = (url: string) => {
    const cleanedUrl = url.trim();
    // Remove trailing slash
    return cleanedUrl.endsWith("/") ? cleanedUrl.slice(0, -1) : cleanedUrl;
  };

  const onSubmit = form.handleSubmit((data) => {
    // Filter out empty strings and validate
    const filteredUrls = data.mirrorUrls.filter((url: string) => url.trim());

    // Validate all non-empty URLs
    const invalidUrls = filteredUrls.filter(
      (url: string) => !validateUrl(url.trim())
    );

    if (invalidUrls.length > 0) {
      form.setError("mirrorUrls", {
        type: "manual",
        message: "All URLs must start with https:// and be valid URLs",
      });
      return;
    }

    // Clean URLs by removing trailing slashes
    const cleanedUrls = filteredUrls.map((url) => cleanUrl(url));

    const formData = formDataToFormData(
      {
        enableMirrorBlossom: data.enableMirrorBlossom,
        mirrorUrls: cleanedUrls.join("\n"),
      },
      "update_blossom_mirrors"
    );

    fetcher.submit(formData, { method: "post" });
  });

  const hasValidationErrors = watchedMirrorUrls.some(
    (url) => url.trim() && !validateUrl(url.trim())
  );

  useEffect(() => {
    if (fetcher.state !== "idle") return;
    if (fetcher.data?.success) {
      clearUploadProviderCache();
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Blossom Media Mirrors</CardTitle>
        <CardDescription>
          Only works if your Media Upload Provider is set to a Blossom option.
          Configure additional Blossom media mirror servers for enhanced
          reliability.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit(e);
          }}
          className="space-y-4"
        >
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enableMirrorBlossom"
              name="enableMirrorBlossom"
              checked={watchedEnableMirror}
              onCheckedChange={(checked) => {
                form.setValue("enableMirrorBlossom", checked as boolean);
                form.clearErrors("mirrorUrls");
              }}
              disabled={isSubmitting}
            />
            <Label
              htmlFor="enableMirrorBlossom"
              className="cursor-pointer text-sm font-normal"
            >
              Enable Blossom Media Mirrors
            </Label>
          </div>

          {watchedEnableMirror ? (
            <div className="space-y-2">
              <Label>Mirror URLs</Label>
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
                  className="w-full"
                >
                  <Plus className={`mr-2 ${INLINE_ICON_SIZE_CLASS}`} />
                  Add Mirror URL
                </Button>
              </div>
              {form.formState.errors.mirrorUrls ? (
                <p className="text-destructive text-sm">
                  {form.formState.errors.mirrorUrls.message ??
                    "Please fix validation errors"}
                </p>
              ) : null}
              <p className="text-muted-foreground text-xs">
                Add Blossom mirror URLs one by one
              </p>
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={isSubmitting || !hasChanged || hasValidationErrors}
            className="w-full"
          >
            {isSubmitting ? "Saving..." : "Save Blossom Settings"}
          </Button>

          {fetcher.data?.success ? (
            <p className="text-success text-sm">
              Blossom settings updated successfully!
            </p>
          ) : null}
          {fetcher.data?.error ? (
            <p className="text-destructive text-sm">{fetcher.data.error}</p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
