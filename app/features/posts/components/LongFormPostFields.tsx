/**
 * Form fields component for LongFormPost
 * Handles title, summary, and custom tags input
 */

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

interface LongFormPostFieldsProps {
  title: string;
  summary: string;
  customTags: string;
  content: string;
  onTitleChange: (title: string) => void;
  onSummaryChange: (summary: string) => void;
  onCustomTagsChange: (tags: string) => void;
  onGenerateSummary: () => void;
  /** When false, only render summary and custom tags (for Article Details). Default true. */
  includeTitle?: boolean;
}

export function LongFormPostFields({
  title,
  summary,
  customTags,
  content,
  onTitleChange,
  onSummaryChange,
  onCustomTagsChange,
  onGenerateSummary,
  includeTitle = true,
}: LongFormPostFieldsProps) {
  return (
    <>
      {includeTitle ? (
        <div>
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            name="title"
            type="text"
            required
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Enter your post title"
            className="mt-1"
          />
        </div>
      ) : null}

      <div>
        <Label htmlFor="summary">Summary *</Label>
        <div className="mt-1 flex gap-2">
          <Textarea
            id="summary"
            name="summary"
            required
            value={summary}
            onChange={(e) => onSummaryChange(e.target.value)}
            placeholder="Brief description of your post"
            rows={3}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={onGenerateSummary}
            disabled={!content}
            className="whitespace-nowrap"
          >
            Auto-generate
          </Button>
        </div>
      </div>

      {/* Custom Tags Input */}
      <div>
        <Label htmlFor="customTags">Custom Tags</Label>
        <Input
          id="customTags"
          name="customTags"
          type="text"
          value={customTags}
          onChange={(e) => onCustomTagsChange(e.target.value)}
          placeholder="Enter custom tags separated by commas (e.g. bitcoin, nostr, technology)"
          className="mt-1"
        />
        <p className="text-muted-foreground dark:text-foreground mt-1 text-xs">
          These tags will be added to the NOSTR event and combined with queue
          type hashtags if any
        </p>
      </div>
    </>
  );
}
