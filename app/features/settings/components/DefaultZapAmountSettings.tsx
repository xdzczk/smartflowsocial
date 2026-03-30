import { useFetcher, useRevalidator } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { PreferenceSection } from "~/features/settings/components/patterns";
import { DEFAULT_ZAP_AMOUNT_SATS_FALLBACK } from "~/lib/zap-defaults";

const PRESETS = [21, 100, 500, 1000] as const;

interface DefaultZapAmountSettingsProps {
  defaultZapAmountSats: number | null;
}

export function DefaultZapAmountSettings({
  defaultZapAmountSats: initialStored,
}: DefaultZapAmountSettingsProps) {
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();
  const revalidator = useRevalidator();
  const resolvedInitial =
    initialStored != null && initialStored >= 1
      ? initialStored
      : DEFAULT_ZAP_AMOUNT_SATS_FALLBACK;
  const [value, setValue] = useState(String(resolvedInitial));
  const lastSaved = useRef(resolvedInitial);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const next =
      initialStored != null && initialStored >= 1
        ? initialStored
        : DEFAULT_ZAP_AMOUNT_SATS_FALLBACK;
    lastSaved.current = next;
    // Sync server-revalidated default into the controlled input when loader data changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional prop → local state sync
    setValue(String(next));
  }, [initialStored]);

  useEffect(() => {
    if (fetcher.data?.success) {
      revalidator.revalidate();
    }
  }, [fetcher.data?.success, revalidator]);

  const submitSats = (sats: number) => {
    if (!Number.isInteger(sats) || sats < 1 || sats > 1_000_000) return;
    if (sats === lastSaved.current) return;
    const fd = new FormData();
    fd.set("_action", "update_default_zap_amount");
    fd.set("defaultZapAmountSats", String(sats));
    fetcher.submit(fd, { method: "post", action: "/dashboard/settings" });
    lastSaved.current = sats;
  };

  const scheduleSave = (raw: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const n = Number(raw.trim());
      if (!Number.isFinite(n)) return;
      const sats = Math.floor(n);
      submitSats(sats);
    }, 450);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const busy = fetcher.state !== "idle";

  return (
    <PreferenceSection
      title="Zap defaults"
      description="Used when pre-filling zap actions in SmartFlow engagement surfaces."
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="default-zap-amount">Default zap amount (sats)</Label>
          <Input
            id="default-zap-amount"
            type="number"
            min={1}
            max={1_000_000}
            value={value}
            disabled={busy}
            onChange={(e) => {
              const v = e.target.value;
              setValue(v);
              scheduleSave(v);
            }}
            onBlur={() => {
              const n = Number(value.trim());
              if (!Number.isFinite(n) || n < 1) {
                setValue(String(lastSaved.current));
                return;
              }
              const sats = Math.min(1_000_000, Math.max(1, Math.floor(n)));
              setValue(String(sats));
              submitSats(sats);
            }}
            className="max-w-[200px]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((n) => (
            <Button
              key={n}
              type="button"
              size="sm"
              variant={Number(value) === n ? "secondary" : "outline"}
              disabled={busy}
              onClick={() => {
                setValue(String(n));
                submitSats(n);
              }}
            >
              {n} sats
            </Button>
          ))}
        </div>
      </div>
    </PreferenceSection>
  );
}
