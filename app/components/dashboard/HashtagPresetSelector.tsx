import { Hash, Check, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

interface HashTagPreset {
  id: string;
  name: string;
  tags: string;
  description?: string | null;
}

interface HashtagPresetSelectorProps {
  presets: HashTagPreset[];
  selectedPresetId?: string | null;
  onSelect: (presetId: string | null, hashtags: string) => void;
  disabled?: boolean;
}

export function HashtagPresetSelector({
  presets,
  selectedPresetId,
  onSelect,
  disabled = false,
}: HashtagPresetSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const selectedPreset = presets.find((p) => p.id === selectedPresetId);

  const handlePresetClick = (preset: HashTagPreset) => {
    if (selectedPresetId === preset.id) {
      // Deselect if clicking on already selected preset
      onSelect(null, "");
    } else {
      onSelect(preset.id, preset.tags);
    }
  };

  const handleClearSelection = () => {
    onSelect(null, "");
  };

  const countHashtags = (tags: string): number => {
    return tags
      .split(/\s+/)
      .filter((tag) => tag.startsWith("#") && tag.length > 1).length;
  };

  if (presets.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Hash className="h-4 w-4" />
            Hashtag Presets
          </CardTitle>
          <CardDescription className="text-xs">
            No hashtag presets available. Create some in Settings to reuse
            hashtags across your posts.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Hash className="h-4 w-4" />
              Hashtag Presets
            </CardTitle>
            <CardDescription className="text-xs">
              {selectedPreset
                ? `Using "${selectedPreset.name}" preset`
                : "Choose a hashtag preset for this post"}
            </CardDescription>
          </div>

          {selectedPreset ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleClearSelection}
              disabled={disabled}
              className="h-6 px-2 text-xs"
            >
              <X className="mr-1 h-3 w-3" />
              Clear
            </Button>
          ) : null}
        </div>

        {selectedPreset && !isExpanded ? (
          <div className="mt-3 rounded-lg bg-muted/50 p-3">
            <div className="mb-2 flex items-center gap-2">
              <h4 className="text-sm font-medium">{selectedPreset.name}</h4>
              <Badge variant="secondary" className="text-xs">
                {countHashtags(selectedPreset.tags)} tags
              </Badge>
            </div>

            {selectedPreset.description ? (
              <p className="mb-2 text-xs text-muted-foreground">
                {selectedPreset.description}
              </p>
            ) : null}

            <div className="mb-2 flex flex-wrap gap-1">
              {selectedPreset.tags
                .split(/\s+/)
                .filter((tag) => tag.startsWith("#") && tag.length > 1)
                .slice(0, 5)
                .map((tag, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="px-2 py-0 text-xs"
                  >
                    {tag}
                  </Badge>
                ))}
              {countHashtags(selectedPreset.tags) > 5 ? (
                <Badge variant="outline" className="px-2 py-0 text-xs">
                  +{countHashtags(selectedPreset.tags) - 5} more
                </Badge>
              ) : null}
            </div>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setIsExpanded(true)}
              disabled={disabled}
              className="h-6 px-2 text-xs"
            >
              Change Preset
            </Button>
          </div>
        ) : null}

        {!selectedPreset || isExpanded ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            disabled={disabled}
            className="mt-2 h-6 px-2 text-xs"
          >
            {isExpanded ? "Show Less" : "Show Presets"}
          </Button>
        ) : null}
      </CardHeader>

      {!selectedPreset || isExpanded ? (
        <CardContent className="pt-0">
          <div className="max-h-64 overflow-y-auto">
            <div className="space-y-2">
              {presets.map((preset) => {
                const handleKeyDown = (e: React.KeyboardEvent) => {
                  if (!disabled && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    handlePresetClick(preset);
                  }
                };

                return (
                  <div
                    key={preset.id}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${selectedPresetId === preset.id
                        ? "border-primary bg-primary/10"
                        : "hover:bg-accent/50"
                      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                    onClick={() => !disabled && handlePresetClick(preset)}
                    onKeyDown={handleKeyDown}
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                  >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <h4 className="text-sm font-medium">{preset.name}</h4>
                        <Badge variant="secondary" className="text-xs">
                          {countHashtags(preset.tags)} tags
                        </Badge>
                        {selectedPresetId === preset.id ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : null}
                      </div>

                      {preset.description ? (
                        <p className="mb-2 text-xs text-muted-foreground">
                          {preset.description}
                        </p>
                      ) : null}

                      <div className="flex flex-wrap gap-1">
                        {preset.tags
                          .split(/\s+/)
                          .filter(
                            (tag) => tag.startsWith("#") && tag.length > 1,
                          )
                          .slice(0, 3)
                          .map((tag, index) => (
                            <Badge
                              key={index}
                              variant="outline"
                              className="px-2 py-0 text-xs"
                            >
                              {tag}
                            </Badge>
                          ))}
                        {countHashtags(preset.tags) > 3 ? (
                          <Badge
                            variant="outline"
                            className="px-2 py-0 text-xs"
                          >
                            +{countHashtags(preset.tags) - 3} more
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          {isExpanded && selectedPreset ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setIsExpanded(false)}
              disabled={disabled}
              className="mt-2 h-6 w-full px-2 text-xs"
            >
              Show Selected Only
            </Button>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
