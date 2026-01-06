import { useFetcher } from "@remix-run/react";
import { Plus, X } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { updateRelaysClientSchema } from "~/lib/validation";
import { useZodFieldArray } from "~/lib/validation/hooks/useZodFieldArray";
import { relayUrlSchema } from "~/lib/validation/schemas/settings.schemas";
import {
  useZodForm,
  formDataToFormData,
} from "~/lib/validation/utils.client-safe";

interface RelaysSettingsProps {
  relays: string[];
}

interface FetcherData {
  success?: boolean;
  error?: string;
}

export function RelaysSettings({ relays }: RelaysSettingsProps) {
  const fetcher = useFetcher<FetcherData>();
  const form = useZodForm(updateRelaysClientSchema, {
    defaultValues: {
      relays: relays.length > 0 ? relays : [""],
    },
  });

  const { fields, append, remove } = useZodFieldArray<
    z.infer<typeof updateRelaysClientSchema>,
    "relays"
  >(
    form as unknown as UseFormReturn<z.infer<typeof updateRelaysClientSchema>>,
    "relays"
  );

  const isSubmitting = fetcher.state === "submitting";
  const watchedRelays = form.watch("relays");
  const hasChanged = JSON.stringify(watchedRelays) !== JSON.stringify(relays);

  const onSubmit = form.handleSubmit((data) => {
    // Filter out empty strings and validate
    const filteredRelays = data.relays.filter((relay: string) => relay.trim());

    // Validate all non-empty relays
    const invalidRelays = filteredRelays.filter((relay: string) => {
      try {
        relayUrlSchema.parse(relay);
        return false;
      } catch {
        return true;
      }
    });

    if (invalidRelays.length > 0) {
      form.setError("relays", {
        type: "manual",
        message:
          "All relay URLs must start with wss:// and have a valid domain",
      });
      return;
    }

    const formData = formDataToFormData(
      { relays: filteredRelays.join("\n") },
      "update_relays"
    );

    fetcher.submit(formData, { method: "post" });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nostr Relays</CardTitle>
        <CardDescription>
          Manage your Nostr relay connections for publishing posts
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
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start space-x-2">
                <div className="flex-1">
                  <Input
                    {...form.register(`relays.${index}`)}
                    placeholder="wss://relay.damus.io"
                    disabled={isSubmitting}
                    onChange={(e) => {
                      // Remove spaces from relay URLs
                      const value = e.target.value.replace(/\s/g, "");
                      form.setValue(`relays.${index}`, value, {
                        shouldValidate: true,
                      });
                    }}
                    className={
                      form.formState.errors.relays?.[index]
                        ? "border-destructive"
                        : ""
                    }
                  />
                  {form.formState.errors.relays?.[index] ? (
                    <p className="mt-1 text-sm text-destructive">
                      {form.formState.errors.relays[index].message}
                    </p>
                  ) : null}
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
              Add Relay
            </Button>
          </div>

          {form.formState.errors.relays ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.relays.message}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={isSubmitting || !hasChanged || !form.formState.isValid}
            className="w-full"
          >
            {isSubmitting ? "Saving..." : "Save Relays"}
          </Button>

          {fetcher.data?.success ? (
            <p className="text-sm text-green-600">
              Relays updated successfully!
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
