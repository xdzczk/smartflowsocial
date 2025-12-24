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
    <div className="rounded-lg border bg-white shadow-sm dark:bg-gray-800">
      <div className="border-b px-6 py-4">
        <h3 className="text-lg font-medium">Media Upload Provider</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
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
                className="mt-1 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <label
                  htmlFor="s3"
                  className="block text-sm font-medium text-gray-900 dark:text-gray-100"
                >
                  Amazon S3 (Default)
                </label>

                <div className="mt-2 flex items-center space-x-2 text-xs">
                  <span className="rounded-full bg-green-100 px-2 py-1 text-green-800">
                    ✓ Fast
                  </span>
                  <span className="rounded-full bg-green-100 px-2 py-1 text-green-800">
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
                className="mt-1 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <label
                  htmlFor="blossom-primal"
                  className="block text-sm font-medium text-gray-900 dark:text-gray-100"
                >
                  Primal Blossom (NOSTR)
                </label>

                <div className="mt-2 flex items-center space-x-2 text-xs">
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-800">
                    ⚡ Primal.net
                  </span>
                  <span className="rounded-full bg-green-100 px-2 py-1 text-green-800">
                    ✓ Fast CDN
                  </span>
                  <span className="rounded-full bg-green-100 px-2 py-1 text-green-800">
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
                className="mt-1 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <label
                  htmlFor="blossom-blosstr"
                  className="block text-sm font-medium text-gray-900 dark:text-gray-100"
                >
                  Blosstr Blossom (NOSTR)
                </label>

                <div className="mt-2 flex items-center space-x-2 text-xs">
                  <a
                    href="https://blosstr.com/?ref=smartflow"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-purple-100 px-2 py-1 text-purple-800 underline hover:bg-purple-200"
                  >
                    🌸 Blosstr.com
                  </a>
                  <span className="rounded-full bg-yellow-100 px-2 py-1 text-yellow-800">
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
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Updating..." : "Update Provider"}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
