import { useFetcher } from "@remix-run/react";
import { Plus, X } from "lucide-react";
import { useFieldArray } from "react-hook-form";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  updateBlacklistClientSchema,
  useZodForm,
  formDataToFormData,
} from "~/lib/validation";

interface GiveawayBlacklistSettingsProps {
  giveawayBlacklist: string[];
}

interface FetcherData {
  success?: boolean;
  error?: string;
}

export function GiveawayBlacklistSettings({
  giveawayBlacklist,
}: GiveawayBlacklistSettingsProps) {
  const fetcher = useFetcher<FetcherData>();
  const form = useZodForm(updateBlacklistClientSchema, {
    defaultValues: {
      blacklist: giveawayBlacklist.length > 0 ? giveawayBlacklist : [""],
    },
  });

  // TypeScript has issues with Zod schema inference in useFieldArray
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    // @ts-ignore - Type inference issue with Zod + RHF
    name: "blacklist",
  }) as {
    fields: Array<{ id: string }>;
    append: (value: string) => void;
    remove: (index: number) => void;
  };

  const isSubmitting = fetcher.state === "submitting";
  const watchedBlacklist = form.watch("blacklist");
  const hasChanged =
    JSON.stringify(watchedBlacklist) !== JSON.stringify(giveawayBlacklist);

  const onSubmit = form.handleSubmit((data) => {
    // Filter out empty strings and validate
    const filteredBlacklist = data.blacklist.filter((item: string) =>
      item.trim(),
    );

    // Validate all non-empty items start with npub
    const invalidItems = filteredBlacklist.filter(
      (item: string) => !item.trim().startsWith("npub"),
    );

    if (invalidItems.length > 0) {
      form.setError("blacklist", {
        type: "manual",
        message: "All blacklist items must start with npub",
      });
      return;
    }

    const formData = formDataToFormData(
      { blacklist: filteredBlacklist.join("\n") },
      "update_blacklist",
    );

    fetcher.submit(formData, { method: "post" });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Giveaway Blacklist</CardTitle>
        <CardDescription>
          Manage blocked npub addresses for giveaways and contests
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); void onSubmit(e); }} className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Add npub addresses one by one
            </p>
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start space-x-2">
                <div className="flex-1">
                  <Input
                    {...form.register(`blacklist.${index}`)}
                    placeholder="npub1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    disabled={isSubmitting}
                    className={
                      form.formState.errors.blacklist?.[index]
                        ? "border-destructive"
                        : ""
                    }
                  />
                  {form.formState.errors.blacklist?.[index] ? <p className="mt-1 text-sm text-destructive">
                      {String(form.formState.errors.blacklist[index]?.message)}
                    </p> : null}
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={() => remove(index)}
                  disabled={isSubmitting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => append("")}
              disabled={isSubmitting}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add npub
            </Button>
          </div>

          {form.formState.errors.blacklist ? <p className="text-sm text-destructive">
              {form.formState.errors.blacklist.message}
            </p> : null}

          <Button
            type="submit"
            disabled={isSubmitting || !hasChanged || !form.formState.isValid}
            className="w-full"
          >
            {isSubmitting ? "Saving..." : "Save Blacklist"}
          </Button>

          {fetcher.data?.success ? (
            <p className="text-sm text-green-600">
              Blacklist updated successfully!
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
