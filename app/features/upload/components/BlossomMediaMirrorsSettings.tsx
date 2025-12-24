import { useFetcher } from "@remix-run/react";
import { useState } from "react";

import { DynamicInputList } from "~/components/settings/DynamicInputList";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";


interface BlossomMediaMirrorsSettingsProps {
  enableMirrorBlossom: boolean;
  mirrorUploadUrls: string[];
}

export function BlossomMediaMirrorsSettings({
  enableMirrorBlossom,
  mirrorUploadUrls,
}: BlossomMediaMirrorsSettingsProps) {
  const fetcher = useFetcher();
  const [enableMirrorBlossomState, setEnableMirrorBlossomState] =
    useState(enableMirrorBlossom);
  const [userMirrorUrls, setUserMirrorUrls] = useState(mirrorUploadUrls || []);
  const [mirrorErrors, setMirrorErrors] = useState<string[]>([]);

  const isSubmitting = fetcher.state === "submitting";
  const hasChanged =
    enableMirrorBlossomState !== enableMirrorBlossom ||
    JSON.stringify(userMirrorUrls) !== JSON.stringify(mirrorUploadUrls);

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

  const hasValidationErrors = userMirrorUrls.some(
    (url) => url.trim() && !validateUrl(url.trim()),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const urlList = userMirrorUrls.filter((url) => url.trim());

    if (hasValidationErrors) {
      setMirrorErrors(["Please fix validation errors before submitting"]);
      return;
    }

    const errors: string[] = [];
    urlList.forEach((url, index) => {
      if (!validateUrl(url.trim())) {
        errors.push(
          `Item ${index + 1}: Invalid URL format. Must start with https://`,
        );
      }
    });

    if (errors.length > 0) {
      setMirrorErrors(errors);
      return;
    }

    // Clean URLs by removing trailing slashes
    const cleanedUrls = urlList.map(cleanUrl);

    setMirrorErrors([]);
    const formData = new FormData();
    formData.set("_action", "update_blossom_mirrors");
    if (enableMirrorBlossomState) {
      formData.set("enableMirrorBlossom", "on");
    }
    formData.set("mirrorUrls", cleanedUrls.join("\n"));
    fetcher.submit(formData, { method: "post" });
  };

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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enableMirrorBlossom"
              checked={enableMirrorBlossomState}
              onCheckedChange={(checked) => {
                setEnableMirrorBlossomState(checked as boolean);
                setMirrorErrors([]);
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

          {enableMirrorBlossomState ? (
            <div className="space-y-2">
              <Label>Mirror URLs</Label>
              <DynamicInputList
                items={userMirrorUrls}
                setItems={(newUrls) => {
                  setUserMirrorUrls(newUrls);
                  setMirrorErrors([]);
                }}
                placeholder="https://blossom.example.com"
                validate={validateUrl}
                disabled={isSubmitting}
                preventSpaces={true}
                description="Add Blossom mirror URLs one by one"
              />
            </div>
          ) : null}

          {mirrorErrors.length > 0 ? (
            <div className="space-y-1">
              {mirrorErrors.map((error, index) => (
                <p key={index} className="text-sm text-destructive">
                  {error}
                </p>
              ))}
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
            <p className="text-sm text-green-600">
              Blossom settings updated successfully!
            </p>
          ) : null}
          {fetcher.data?.error ? (
            <p className="text-sm text-destructive">{fetcher.data.error}</p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
