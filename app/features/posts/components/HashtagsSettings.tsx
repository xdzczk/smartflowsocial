import { useFetcher } from "@remix-run/react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { updateTagsClientSchema } from "~/lib/validation";
import {
  useZodForm,
  formDataToFormData,
} from "~/lib/validation/utils.client-safe";

interface HashtagsSettingsProps {
  tags: string;
}

interface FetcherData {
  success?: boolean;
  error?: string;
}

export function HashtagsSettings({ tags }: HashtagsSettingsProps) {
  const fetcher = useFetcher<FetcherData>();
  const form = useZodForm(updateTagsClientSchema, {
    defaultValues: {
      hashtags: tags,
    },
  });

  const isSubmitting = fetcher.state === "submitting";
  const hashtags = form.watch("hashtags");
  const hasChanged = hashtags !== tags;

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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit(e);
          }}
          className="space-y-4"
        >
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

          <Button
            type="submit"
            disabled={isSubmitting || !hasChanged}
            className="w-full"
          >
            {isSubmitting ? "Saving..." : "Save Hashtags"}
          </Button>

          {fetcher.data?.success ? (
            <p className="text-success text-sm">
              Hashtags updated successfully!
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
