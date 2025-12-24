import { useFetcher } from "@remix-run/react";
import { useState } from "react";

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

interface HashtagsSettingsProps {
  tags: string;
  showHashTagsInPosts: boolean;
}

export function HashtagsSettings({
  tags,
  showHashTagsInPosts,
}: HashtagsSettingsProps) {
  const fetcher = useFetcher();
  const [hashtags, setHashtags] = useState(tags);
  const [showHashTagsState, setShowHashTagsState] =
    useState(showHashTagsInPosts);

  const isSubmitting = fetcher.state === "submitting";
  const hasChanged =
    hashtags !== tags || showHashTagsState !== showHashTagsInPosts;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.set("_action", "update_tags");
    formData.set("hashtags", hashtags);
    if (showHashTagsState) {
      formData.set("showHashTagsInPosts", "on");
    }
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Default Post Hashtags</CardTitle>
        <CardDescription>
          Set default hashtags that will be applied to your posts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hashtags">Hashtags</Label>
            <Textarea
              id="hashtags"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#bitcoin #nostr #zap #sats #lightning"
              disabled={isSubmitting}
              rows={2}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="showHashTagsInPosts"
              checked={showHashTagsState}
              onCheckedChange={(checked) =>
                setShowHashTagsState(checked as boolean)
              }
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
