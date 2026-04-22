import { Link } from "@remix-run/react";

import { Button } from "~/components/ui/button";

/**
 * Templates header component
 */
export function TemplatesHeader() {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-h1">Templates</h1>
        <p className="dark:text-text-secondary text-text">
          Reusable blueprints for posts and articles.
        </p>
      </div>
      <Button asChild>
        <Link to="/dashboard/templates?create=1">Create template</Link>
      </Button>
    </div>
  );
}
