/**
 * Type picker for creating a template from scratch.
 * User chooses Short post or Longform, then navigates to the template-only composer.
 */

import { Link } from "@remix-run/react";

import { Button } from "~/components/ui/button";

export default function TemplateNewTypePicker() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          to="/dashboard/templates"
          className="text-primary hover:text-primary/90 dark:text-muted-foreground dark:hover:text-foreground text-sm"
        >
          ← Back to Templates
        </Link>
      </div>
      <h2 className="mb-2 text-xl font-semibold">Create template</h2>
      <p className="text-muted-foreground mb-6 text-sm">
        Choose the type of template you want to create.
      </p>
      <div className="flex flex-wrap gap-4">
        <Button asChild variant="default" size="lg">
          <Link to="/dashboard/templates/new/post">Short post</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/dashboard/templates/new/longform">Article</Link>
        </Button>
      </div>
    </div>
  );
}
