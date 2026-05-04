import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "@remix-run/react";

import { PageContent } from "~/components/layout/PageContent";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { PublishingPageHeader } from "~/features/posts/components/publishing-suite/PublishingPageHeader";
import { cn } from "~/lib/utils";

import {
  groupVisibleSettingsSections,
  type SettingsSectionDef,
  type SettingsTabId,
} from "../settings-sections";

function searchWithTab(
  searchParams: URLSearchParams,
  tab: SettingsTabId
): string {
  const next = new URLSearchParams(searchParams);
  next.set("tab", tab);
  if (tab !== "billing") {
    next.delete("billing");
  }
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
  const grouped = groupVisibleSettingsSections(sections);

  // No overflow-x-hidden on root  -  it breaks `position:sticky` on the rail (same as dashboard main / ActionRail).
  return (
    <PageContent fluid className="pb-8" data-testid="settings-page">
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
              if (value !== "billing") {
                next.delete("billing");
              }
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
              {grouped.map((g) => (
                <SelectGroup key={g.groupId}>
                  <SelectLabel className="text-text-secondary px-2 py-1.5 text-[11px] font-medium tracking-wide">
                    {g.groupLabel}
                  </SelectLabel>
                  {g.items.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
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
          className="border-border bg-surface-raised shadow-2 hidden w-full shrink-0 rounded-lg border lg:sticky lg:top-[4.75rem] lg:z-10 lg:flex lg:max-h-[calc(100dvh-5.75rem)] lg:w-[300px] lg:flex-col lg:self-start xl:w-[320px]"
          aria-label="Settings sections"
          data-testid="settings-section-rail"
        >
          <nav className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">
            <div className="space-y-3">
              {grouped.map((g) => (
                <div key={g.groupId}>
                  <p className="text-text-secondary px-2 pb-1 text-[10px] font-medium tracking-wide uppercase">
                    {g.groupLabel}
                  </p>
                  <ul className="flex flex-col gap-px">
                    {g.items.map((section) => {
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
                              "focus-ring-offset motion-fast block rounded-md px-2.5 py-2 text-sm",
                              isActive
                                ? "bg-surface-selected text-text border-border-subtle border font-semibold"
                                : "text-text-secondary hover:bg-surface-hover/70 hover:text-text"
                            )}
                            data-testid={`settings-nav-item-${section.id}`}
                            aria-current={isActive ? "page" : undefined}
                          >
                            <span className="block leading-tight">
                              {section.label}
                            </span>
                            {section.description ? (
                              <span className="text-text-secondary mt-0.5 block text-[11px] leading-snug font-normal">
                                {section.description}
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </nav>
        </aside>
      </div>
    </PageContent>
  );
}
