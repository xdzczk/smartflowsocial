/**
 * Templates/Assets header component
 */

export function TemplatesHeader() {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">Assets</h1>
        <p className="dark:text-muted-foreground text-foreground">
          Manage your reusable content assets
        </p>
      </div>
    </div>
  );
}
