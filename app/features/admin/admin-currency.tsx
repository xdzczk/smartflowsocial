import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { AdminBtcSpotRates } from "./admin-fx-rates.server";
import {
  type AdminDisplayUnit,
  adminMoneyColumnLabel,
  formatSatsForAdminUnit,
  persistAdminDisplayUnit,
  readStoredAdminDisplayUnit,
} from "./format-admin-money";

type FxState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; rates: AdminBtcSpotRates }
  | { status: "error" };

interface AdminCurrencyContextValue {
  unit: AdminDisplayUnit;
  setUnit: (u: AdminDisplayUnit) => void;
  fx: FxState;
  refetchFx: () => void;
  formatSats: (sats: number | bigint | string, locale?: string) => string;
  spotFootnote: string | null;
  moneyColumnLabel: string;
}

const AdminCurrencyContext = createContext<AdminCurrencyContextValue | null>(
  null
);

function spotFromFx(fx: FxState): { btcUsd: number; btcEur: number } | null {
  return fx.status === "ok"
    ? { btcUsd: fx.rates.btcUsd, btcEur: fx.rates.btcEur }
    : null;
}

export function AdminCurrencyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [unit, setUnitState] = useState<AdminDisplayUnit>("SATS");
  const [fx, setFx] = useState<FxState>({ status: "idle" });

  useEffect(() => {
    queueMicrotask(() => {
      setUnitState(readStoredAdminDisplayUnit());
    });
  }, []);

  const setUnit = useCallback((u: AdminDisplayUnit) => {
    setUnitState(u);
    persistAdminDisplayUnit(u);
  }, []);

  const loadFx = useCallback(() => {
    setFx({ status: "loading" });
    void (async () => {
      try {
        const res = await fetch("/api/admin/fx-rates", {
          credentials: "include",
        });
        if (!res.ok) {
          setFx({ status: "error" });
          return;
        }
        const data = (await res.json()) as AdminBtcSpotRates;
        if (
          typeof data.btcUsd === "number" &&
          typeof data.btcEur === "number" &&
          typeof data.fetchedAt === "string"
        ) {
          setFx({ status: "ok", rates: data });
        } else {
          setFx({ status: "error" });
        }
      } catch {
        setFx({ status: "error" });
      }
    })();
  }, []);

  useEffect(() => {
    if (unit !== "USD" && unit !== "EUR") return;
    queueMicrotask(() => {
      loadFx();
    });
  }, [unit, loadFx]);

  const refetchFx = useCallback(() => {
    loadFx();
  }, [loadFx]);

  const spotFootnote = useMemo(() => {
    if (unit !== "USD" && unit !== "EUR") return null;
    if (fx.status === "loading" || fx.status === "idle") return null;
    if (fx.status === "error") {
      return "Fiat spot unavailable — showing sats.";
    }
    return `Fiat from Kraken last trade (XBTUSDC, XBTEUR), ${fx.rates.fetchedAt}. Display only.`;
  }, [unit, fx]);

  const moneyColumnLabel = useMemo(() => {
    const colUnit: AdminDisplayUnit =
      (unit === "USD" || unit === "EUR") && fx.status !== "ok" ? "SATS" : unit;
    return adminMoneyColumnLabel(colUnit);
  }, [unit, fx.status]);

  const formatSats = useCallback(
    (sats: number | bigint | string, locale?: string) => {
      const spot = spotFromFx(fx);
      const effectiveUnit: AdminDisplayUnit =
        (unit === "USD" || unit === "EUR") && fx.status !== "ok"
          ? "SATS"
          : unit;
      return formatSatsForAdminUnit(sats, effectiveUnit, spot, locale);
    },
    [fx, unit]
  );

  const value = useMemo(
    () =>
      ({
        unit,
        setUnit,
        fx,
        refetchFx,
        formatSats,
        spotFootnote,
        moneyColumnLabel,
      }) satisfies AdminCurrencyContextValue,
    [unit, setUnit, fx, refetchFx, formatSats, spotFootnote, moneyColumnLabel]
  );

  return (
    <AdminCurrencyContext.Provider value={value}>
      {children}
    </AdminCurrencyContext.Provider>
  );
}

export function useAdminCurrency(): AdminCurrencyContextValue {
  const ctx = useContext(AdminCurrencyContext);
  if (!ctx) {
    throw new Error(
      "useAdminCurrency must be used within AdminCurrencyProvider"
    );
  }
  return ctx;
}

/** Safe for pages that might render outside provider (should not happen on admin). */
export function useAdminCurrencyOptional(): AdminCurrencyContextValue | null {
  return useContext(AdminCurrencyContext);
}
