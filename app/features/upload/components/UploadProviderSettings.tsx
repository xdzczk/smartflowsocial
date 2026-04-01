import { Link, useFetcher } from "@remix-run/react";
import { Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ProviderSelectionSection } from "~/features/settings/components/patterns";
import { BRAND_BLOSSOM_LABEL, BRAND_NAME } from "~/lib/brand";
import { clearUploadProviderCache } from "~/lib/query";
import { cn } from "~/lib/utils";

interface UploadProviderSettingsProps {
  /** Effective provider used for uploads (may differ from stored when SFS is unavailable). */
  uploadProvider: string;
  /** Persisted preference from DB (tier-resolved); used for legacy SFS messaging. */
  uploadProviderStored: string;
  customBlossomUrl?: string | null;
  isSubscriptionActiveForGating: boolean;
}

function normalizeProviderId(uploadProvider: string): string {
  if (uploadProvider === "S3" || uploadProvider === "BLOSSOM") {
    return "BLOSSOM_PRIMAL";
  }
  return uploadProvider;
}

function isValidHttpsUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("https://")) return false;
  try {
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function UploadProviderSettings({
  uploadProvider,
  uploadProviderStored,
  customBlossomUrl,
  isSubscriptionActiveForGating,
}: UploadProviderSettingsProps) {
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();
  const isSubmitting =
    fetcher.state === "submitting" &&
    fetcher.formData?.get("_action") === "update_upload_provider";

  const baselineProvider = normalizeProviderId(uploadProvider);
  const baselineCustom = (customBlossomUrl ?? "").trim();

  const [selectedProvider, setSelectedProvider] = useState(baselineProvider);
  const [customBlossomUrlInput, setCustomBlossomUrlInput] = useState(
    customBlossomUrl ?? ""
  );

  useEffect(() => {
    if (fetcher.state !== "idle") return;
    if (fetcher.data?.success) {
      clearUploadProviderCache();
    }
  }, [fetcher.state, fetcher.data]);

  const isCustomSelected = selectedProvider === "BLOSSOM_CUSTOM";
  const customUrlValid = isValidHttpsUrl(customBlossomUrlInput);
  const customUrlError =
    isCustomSelected && customBlossomUrlInput.trim() && !customUrlValid;

  const isDirty = useMemo(() => {
    if (selectedProvider !== baselineProvider) return true;
    if (selectedProvider === "BLOSSOM_CUSTOM") {
      return customBlossomUrlInput.trim() !== baselineCustom;
    }
    return false;
  }, [
    selectedProvider,
    baselineProvider,
    customBlossomUrlInput,
    baselineCustom,
  ]);

  const storedNorm = normalizeProviderId(uploadProviderStored);
  const isSfsLocked = !isSubscriptionActiveForGating;
  const isLegacyStoredSfs =
    isSfsLocked &&
    storedNorm === "BLOSSOM_SFS" &&
    baselineProvider !== "BLOSSOM_SFS";

  const submitDisabled =
    isSubmitting ||
    !isDirty ||
    (isCustomSelected && !customUrlValid) ||
    (isSfsLocked && selectedProvider === "BLOSSOM_SFS");

  const primaryAccentColor = "hsl(var(--primary))";
  const optionRowBase =
    "flex items-start space-x-3 rounded-lg border p-3 transition-colors";
  const optionRowSelected = "border-primary bg-muted/30";

  const ctaLabel = (() => {
    if (!isDirty) return "Save provider";
    if (selectedProvider === "BLOSSOM_CUSTOM") return "Save custom provider";
    return "Save provider";
  })();

  return (
    <ProviderSelectionSection
      title="Media upload provider"
      description="Choose how your media files are stored and served."
      className={cn("transition-shadow", isDirty && "ring-border/80 ring-1")}
    >
      <fetcher.Form method="post">
        <input type="hidden" name="_action" value="update_upload_provider" />

        <div className="space-y-3">
          <div
            className={cn(
              optionRowBase,
              (selectedProvider === "BLOSSOM_PRIMAL" ||
                selectedProvider === "BLOSSOM") &&
                optionRowSelected
            )}
          >
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
              <p className="text-muted-foreground mt-1 text-xs">
                primal.net · default for Free
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="default">Default for Free plan</Badge>
                <Badge variant="outline">Fast CDN</Badge>
              </div>
            </div>
          </div>

          <div
            className={cn(
              optionRowBase,
              selectedProvider === "BLOSSOM_BLOSSTR" && optionRowSelected
            )}
          >
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
              <p className="text-muted-foreground mt-1 text-xs">
                blosstr.com — third-party Blosstr account
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="default">Subscription required</Badge>
              </div>
            </div>
          </div>

          {isSfsLocked ? (
            <div
              className={cn(
                optionRowBase,
                "border-muted-foreground/25 bg-muted/20"
              )}
            >
              <div className="text-muted-foreground mt-0.5">
                <Lock className="h-4 w-4" aria-hidden />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-foreground text-sm font-medium">
                    {BRAND_BLOSSOM_LABEL} (NOSTR)
                  </span>
                  <Badge variant="secondary">Paid feature</Badge>
                  <Badge variant="outline">Locked on Free plan</Badge>
                </div>
                <p className="text-muted-foreground text-xs">
                  blossom-api.smartflow.social · blossom.smartflow.social
                </p>
                {isLegacyStoredSfs ? (
                  <p className="text-muted-foreground text-xs">
                    Previously selected — unavailable on your current plan.
                    Uploads use your effective provider above until you upgrade.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="default">Default for paid plan</Badge>
                  <Badge variant="outline">Subscription required</Badge>
                </div>
                <Button variant="secondary" size="sm" asChild>
                  <Link to="/plans">Upgrade to use {BRAND_BLOSSOM_LABEL}</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                optionRowBase,
                selectedProvider === "BLOSSOM_SFS" && optionRowSelected
              )}
            >
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
                  {BRAND_BLOSSOM_LABEL} (NOSTR)
                </label>
                <p className="text-muted-foreground mt-1 text-xs">
                  blossom-api.smartflow.social · blossom.smartflow.social
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="default">Default for paid plan</Badge>
                  <Badge variant="outline">Subscription required</Badge>
                </div>
              </div>
            </div>
          )}

          <div
            className={cn(
              optionRowBase,
              selectedProvider === "BLOSSOM_CUSTOM" && optionRowSelected
            )}
          >
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
                Custom Blossom provider
              </label>
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                Use your own trusted HTTPS Blossom endpoint for uploads from
                {BRAND_NAME}. Only HTTPS URLs are accepted;{" "}
                <span className="text-foreground/90">
                  format is validated when you save
                </span>
                . Uploads use this endpoint as the primary media server.
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
                className={cn(
                  "border-input bg-background ring-offset-background mt-3 w-full rounded-md border px-3 py-2 text-sm",
                  customUrlError && "border-destructive"
                )}
                aria-invalid={customUrlError ? true : undefined}
              />
              {customUrlError ? (
                <p className="text-destructive mt-1 text-xs">
                  Enter a valid HTTPS URL.
                </p>
              ) : (
                <p className="text-muted-foreground mt-2 text-xs">
                  Must start with https://
                </p>
              )}
            </div>
          </div>
        </div>

        {fetcher.state === "idle" && fetcher.data?.error ? (
          <p className="text-destructive mt-4 text-sm">{fetcher.data.error}</p>
        ) : null}

        {isDirty ? (
          <p className="text-muted-foreground mt-4 text-xs">Unsaved changes</p>
        ) : null}

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={submitDisabled}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Saving…" : ctaLabel}
          </button>
        </div>
      </fetcher.Form>
    </ProviderSelectionSection>
  );
}
