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
  subtitle = "Preferences and infrastructure for your workspace.",
  children,
}: SettingsShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  return (
    <div
      className="mx-auto w-full max-w-7xl overflow-x-hidden p-4 sm:p-6"
      data-testid="settings-page"
    >
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-xl text-sm sm:text-base">
          {subtitle}
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:gap-8">
        <nav
          className="hidden shrink-0 lg:block lg:w-60"
          aria-label="Settings sections"
          data-testid="settings-nav-desktop"
        >
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
                      "focus-visible:ring-ring block rounded-md px-3 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                      isActive
                        ? "bg-muted text-foreground border-l-primary border-l-2 font-medium"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border-l-2 border-transparent"
                    )}
                    data-testid={`settings-nav-item-${section.id}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className="block leading-snug">{section.label}</span>
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

        <div className="lg:hidden" data-testid="settings-nav-mobile">
          <Label htmlFor="settings-section-select" className="mb-2 block">
            Section
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
          className="max-w-[900px] min-w-0 flex-1 space-y-6 overflow-x-hidden"
          data-testid="settings-active-panel"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
