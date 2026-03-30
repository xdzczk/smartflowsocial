import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "@remix-run/react";

import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { PublishingPageHeader } from "~/features/posts/components/publishing-suite/PublishingPageHeader";
import { cn } from "~/lib/utils";

import type { SettingsSectionDef, SettingsTabId } from "../settings-sections";

function searchWithTab(
  searchParams: URLSearchParams,
  tab: SettingsTabId
): string {
  const next = new URLSearchParams(searchParams);
  next.set("tab", tab);
  const q = next.toString();
  return q ? `?${q}` : "";
}

export interface SettingsShellProps {
  sections: SettingsSectionDef[];
  activeTab: SettingsTabId;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function SettingsShell({
  sections,
  activeTab,
  title = "Settings",
  subtitle = "Workspace preferences, publishing defaults, and infrastructure.",
  children,
}: SettingsShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  return (
    <div
      className="mx-auto w-full max-w-[1400px] overflow-x-hidden px-4 pb-8 sm:px-6"
      data-testid="settings-page"
    >
      <div className="pt-2 pb-4">
        <PublishingPageHeader title={title} subtitle={subtitle} />
      </div>

      <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="lg:hidden" data-testid="settings-nav-mobile">
          <Label htmlFor="settings-section-select" className="mb-2 block">
            Settings section
          </Label>
          <Select
            value={activeTab}
            onValueChange={(value) => {
              const next = new URLSearchParams(searchParams);
              next.set("tab", value);
              const search = next.toString();
              navigate(
                {
                  pathname: location.pathname,
                  search: search ? `?${search}` : "",
                },
                { replace: true, preventScrollReset: true }
              );
            }}
          >
            <SelectTrigger
              id="settings-section-select"
              className="w-full"
              aria-label="Settings section"
            >
              <SelectValue placeholder="Choose section" />
            </SelectTrigger>
            <SelectContent>
              {sections.map((section) => (
                <SelectItem key={section.id} value={section.id}>
                  {section.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          className="w-full max-w-[880px] min-w-0 flex-1 overflow-x-hidden"
          data-testid="settings-active-panel"
        >
          {children}
        </div>

        <aside
          className="border-border bg-muted/25 hidden w-full shrink-0 rounded-xl border shadow-sm lg:sticky lg:top-[4.75rem] lg:flex lg:max-h-[calc(100vh-5.75rem)] lg:w-[300px] lg:flex-col lg:self-start xl:w-[320px]"
          aria-label="Settings sections"
          data-testid="settings-section-rail"
        >
          <nav className="min-h-0 flex-1 overflow-y-auto p-2">
            <p className="text-muted-foreground px-2 pt-1 pb-2 text-[11px] font-medium tracking-wide uppercase">
              Sections
            </p>
            <ul className="flex flex-col gap-0.5">
              {sections.map((section) => {
                const isActive = section.id === activeTab;
                return (
                  <li key={section.id}>
                    <Link
                      to={{
                        pathname: location.pathname,
                        search: searchWithTab(searchParams, section.id),
                      }}
                      replace
                      preventScrollReset
                      className={cn(
                        "focus-visible:ring-ring block rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                        isActive
                          ? "bg-background text-foreground ring-border/80 font-semibold ring-1 shadow-sm"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                      data-testid={`settings-nav-item-${section.id}`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className="block leading-snug">
                        {section.label}
                      </span>
                      {section.description ? (
                        <span className="text-muted-foreground mt-0.5 block text-xs font-normal">
                          {section.description}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
      </div>
    </div>
  );
}
