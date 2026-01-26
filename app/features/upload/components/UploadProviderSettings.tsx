import { Form, useNavigation } from "@remix-run/react";
interface UploadProviderSettingsProps {
  uploadProvider: string;
}

export function UploadProviderSettings({
  uploadProvider,
}: UploadProviderSettingsProps) {
  const navigation = useNavigation();
  const isSubmitting =
    navigation.state === "submitting" &&
    navigation.formData?.get("_action") === "update_upload_provider";

  return (
    <div className="dark:bg-card rounded-lg border bg-white shadow-sm">
      <div className="border-b px-6 py-4">
        <h3 className="text-lg font-medium">Media Upload Provider</h3>
        <p className="text-muted-foreground dark:text-foreground mt-1 text-sm">
          Choose how your media files are stored and served
        </p>
      </div>

      <div className="p-6">
        <Form method="post">
          <input type="hidden" name="_action" value="update_upload_provider" />

          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <input
                id="s3"
                name="uploadProvider"
                type="radio"
                value="S3"
                defaultChecked={uploadProvider === "S3"}
                className="border-border text-primary focus:ring-primary mt-1 h-4 w-4"
              />
              <div className="flex-1">
                <label
                  htmlFor="s3"
                  className="text-foreground dark:text-foreground block text-sm font-medium"
                >
                  Amazon S3 (Default)
                </label>

                <div className="mt-2 flex items-center space-x-2 text-xs">
                  <span className="bg-success/20 text-success rounded-full px-2 py-1">
                    ✓ Fast
                  </span>
                  <span className="bg-success/20 text-success rounded-full px-2 py-1">
                    ✓ Reliable
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <input
                id="blossom-primal"
                name="uploadProvider"
                type="radio"
                value="BLOSSOM_PRIMAL"
                defaultChecked={
                  uploadProvider === "BLOSSOM_PRIMAL" ||
                  uploadProvider === "BLOSSOM"
                }
                className="border-border text-primary focus:ring-primary mt-1 h-4 w-4"
              />
              <div className="flex-1">
                <label
                  htmlFor="blossom-primal"
                  className="text-foreground dark:text-foreground block text-sm font-medium"
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
                    ✓ Free
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
                defaultChecked={uploadProvider === "BLOSSOM_BLOSSTR"}
                className="border-border text-primary focus:ring-primary mt-1 h-4 w-4"
              />
              <div className="flex-1">
                <label
                  htmlFor="blossom-blosstr"
                  className="text-foreground dark:text-foreground block text-sm font-medium"
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
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Updating..." : "Update Provider"}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
