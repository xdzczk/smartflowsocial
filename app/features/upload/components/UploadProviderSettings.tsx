import { useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { clearUploadProviderCache } from "~/lib/query";

interface UploadProviderSettingsProps {
  uploadProvider: string;
  customBlossomUrl?: string | null;
}

export function UploadProviderSettings({
  uploadProvider,
  customBlossomUrl,
}: UploadProviderSettingsProps) {
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();
  const isSubmitting =
    fetcher.state === "submitting" &&
    fetcher.formData?.get("_action") === "update_upload_provider";
  const normalizedProvider =
    uploadProvider === "S3" ? "BLOSSOM_PRIMAL" : uploadProvider;
  const [selectedProvider, setSelectedProvider] = useState(normalizedProvider);
  const [customBlossomUrlInput, setCustomBlossomUrlInput] = useState(
    customBlossomUrl ?? ""
  );
  const isCustomSelected = selectedProvider === "BLOSSOM_CUSTOM";

  useEffect(() => {
    if (fetcher.state !== "idle") return;
    if (fetcher.data?.success) {
      clearUploadProviderCache();
    }
  }, [fetcher.state, fetcher.data]);

  const primaryAccentColor = "hsl(var(--primary))";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Media Upload Provider</CardTitle>
        <CardDescription>
          Choose how your media files are stored and served
        </CardDescription>
      </CardHeader>
      <CardContent>
        <fetcher.Form method="post">
          <input type="hidden" name="_action" value="update_upload_provider" />

          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <input
                id="blossom-primal"
                name="uploadProvider"
                type="radio"
                value="BLOSSOM_PRIMAL"
                checked={
                  selectedProvider === "BLOSSOM_PRIMAL" ||
                  selectedProvider === "BLOSSOM"
                }
                onChange={() => setSelectedProvider("BLOSSOM_PRIMAL")}
                className="border-border accent-checkbox focus:ring-ring mt-1 h-4 w-4"
                style={{ accentColor: primaryAccentColor }}
              />
              <div className="flex-1">
                <label
                  htmlFor="blossom-primal"
                  className="text-foreground block text-sm font-medium"
                >
                  Primal Blossom (NOSTR)
                </label>

                <div className="mt-2 flex items-center space-x-2 text-xs">
                  <span className="bg-muted text-foreground rounded-full px-2 py-1">
                    ⚡ Primal.net
                  </span>
                  <span className="bg-success/20 text-success rounded-full px-2 py-1">
                    ✓ Fast CDN
                  </span>
                  <span className="bg-success/20 text-success rounded-full px-2 py-1">
                    ✓ Default for free plan
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <input
                id="blossom-blosstr"
                name="uploadProvider"
                type="radio"
                value="BLOSSOM_BLOSSTR"
                checked={selectedProvider === "BLOSSOM_BLOSSTR"}
                onChange={() => setSelectedProvider("BLOSSOM_BLOSSTR")}
                className="border-border accent-checkbox focus:ring-ring mt-1 h-4 w-4"
                style={{ accentColor: primaryAccentColor }}
              />
              <div className="flex-1">
                <label
                  htmlFor="blossom-blosstr"
                  className="text-foreground block text-sm font-medium"
                >
                  Blosstr Blossom (NOSTR)
                </label>

                <div className="mt-2 flex items-center space-x-2 text-xs">
                  <a
                    href="https://blosstr.com/?ref=smartflow"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-muted text-foreground hover:bg-muted/80 rounded-full px-2 py-1 underline"
                  >
                    🌸 Blosstr.com
                  </a>
                  <span className="bg-muted text-foreground rounded-full px-2 py-1">
                    🔒 Subscription required
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <input
                id="blossom-sfs"
                name="uploadProvider"
                type="radio"
                value="BLOSSOM_SFS"
                checked={selectedProvider === "BLOSSOM_SFS"}
                onChange={() => setSelectedProvider("BLOSSOM_SFS")}
                className="border-border accent-checkbox focus:ring-ring mt-1 h-4 w-4"
                style={{ accentColor: primaryAccentColor }}
              />
              <div className="flex-1">
                <label
                  htmlFor="blossom-sfs"
                  className="text-foreground block text-sm font-medium"
                >
                  SmartFlow Blossom (NOSTR)
                </label>

                <div className="mt-2 flex items-center space-x-2 text-xs">
                  <span className="bg-muted text-foreground rounded-full px-2 py-1">
                    blossom-api.smartflow.social / blossom.smartflow.social
                  </span>
                  <span className="bg-success/20 text-success rounded-full px-2 py-1">
                    ✓ Default for paid plan
                  </span>
                  <span className="bg-muted text-foreground rounded-full px-2 py-1">
                    🔒 Subscription required
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <input
                id="blossom-custom"
                name="uploadProvider"
                type="radio"
                value="BLOSSOM_CUSTOM"
                checked={selectedProvider === "BLOSSOM_CUSTOM"}
                onChange={() => setSelectedProvider("BLOSSOM_CUSTOM")}
                className="border-border accent-checkbox focus:ring-ring mt-1 h-4 w-4"
                style={{ accentColor: primaryAccentColor }}
              />
              <div className="flex-1">
                <label
                  htmlFor="blossom-custom"
                  className="text-foreground block text-sm font-medium"
                >
                  Custom Blossom Provider
                </label>
                <p className="text-muted-foreground mt-2 text-xs">
                  Use a trusted HTTPS Blossom endpoint. This URL is used as your
                  primary upload server.
                </p>
                <input
                  type="url"
                  name="customBlossomUrl"
                  value={customBlossomUrlInput}
                  onChange={(event) =>
                    setCustomBlossomUrlInput(event.target.value)
                  }
                  disabled={!isCustomSelected}
                  placeholder="https://your-blossom.example.com"
                  className="border-input bg-background ring-offset-background mt-3 w-full rounded-md border px-3 py-2 text-sm"
                />
                <p className="text-muted-foreground mt-2 text-xs">
                  Only `https://` URLs are accepted.
                </p>
              </div>
            </div>
          </div>

          {fetcher.state === "idle" && fetcher.data?.error ? (
            <p className="text-destructive mt-4 text-sm">
              {fetcher.data.error}
            </p>
          ) : null}

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Updating..." : "Update Provider"}
            </button>
          </div>
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}
