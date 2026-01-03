import { useFetcher } from "@remix-run/react";

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
import { Textarea } from "~/components/ui/textarea";
import {
  updateTagsClientSchema,
  useZodForm,
  formDataToFormData,
} from "~/lib/validation";

interface HashtagsSettingsProps {
  tags: string;
  showHashTagsInPosts: boolean;
}

interface FetcherData {
  success?: boolean;
  error?: string;
}

export function HashtagsSettings({
  tags,
  showHashTagsInPosts,
}: HashtagsSettingsProps) {
  const fetcher = useFetcher<FetcherData>();
  const form = useZodForm(updateTagsClientSchema, {
    defaultValues: {
      hashtags: tags,
      showHashTagsInPosts: showHashTagsInPosts,
    },
  });

  const isSubmitting = fetcher.state === "submitting";
  const hashtags = form.watch("hashtags");
  const showHashTagsState = form.watch("showHashTagsInPosts");
  const hasChanged =
    hashtags !== tags || showHashTagsState !== showHashTagsInPosts;

  const onSubmit = form.handleSubmit((data) => {
    const formData = formDataToFormData(data, "update_tags");
    fetcher.submit(formData, { method: "post" });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Default Post Hashtags</CardTitle>
        <CardDescription>
          Set default hashtags that will be applied to your posts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); void onSubmit(e); }} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hashtags">Hashtags</Label>
            <Textarea
              id="hashtags"
              {...form.register("hashtags")}
              placeholder="#bitcoin #nostr #zap #sats #lightning"
              disabled={isSubmitting}
              rows={2}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="showHashTagsInPosts"
              checked={showHashTagsState}
              onCheckedChange={(checked) => {
                form.setValue("showHashTagsInPosts", checked as boolean);
              }}
              disabled={isSubmitting}
            />
            <Label
              htmlFor="showHashTagsInPosts"
              className="cursor-pointer text-sm font-normal"
            >
              Show hashtags in posts (tags will only be shown in post metadata)
            </Label>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || !hasChanged}
            className="w-full"
          >
            {isSubmitting ? "Saving..." : "Save Hashtags"}
          </Button>

          {fetcher.data?.success ? (
            <p className="text-sm text-green-600">
              Hashtags updated successfully!
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
