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

function normalizeRatesFromApi(
  data: Record<string, unknown>
): AdminBtcSpotRates | null {
  const btcUsd = data["btcUsd"];
  const btcEur = data["btcEur"];
  const fetchedAt = data["fetchedAt"];
  const source = data["source"];
  if (
    typeof btcUsd !== "number" ||
    typeof btcEur !== "number" ||
    typeof fetchedAt !== "string"
  ) {
    return null;
  }
  const src = source === "coingecko" || source === "kraken" ? source : "kraken";
  return { btcUsd, btcEur, fetchedAt, source: src };
}

function initialFxState(
  initialFx: AdminBtcSpotRates | null,
  initialFxError: boolean
): FxState {
  if (initialFx) return { status: "ok", rates: initialFx };
  if (initialFxError) return { status: "error" };
  return { status: "idle" };
}

export function AdminCurrencyProvider({
  children,
  initialFx,
  initialFxError,
}: {
  children: React.ReactNode;
  initialFx: AdminBtcSpotRates | null;
  initialFxError: boolean;
}) {
  const [unit, setUnitState] = useState<AdminDisplayUnit>("SATS");
  const [fx, setFx] = useState<FxState>(() =>
    initialFxState(initialFx, initialFxError)
  );

  useEffect(() => {
    queueMicrotask(() => {
      setUnitState(readStoredAdminDisplayUnit());
    });
  }, []);

  useEffect(() => {
    if (!initialFx) return;
    queueMicrotask(() => {
      setFx({ status: "ok", rates: initialFx });
    });
  }, [initialFx]);

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
        const raw = (await res.json()) as Record<string, unknown>;
        const data = normalizeRatesFromApi(raw);
        if (data) {
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
    if (fx.status === "ok") return;
    queueMicrotask(() => {
      loadFx();
    });
  }, [unit, loadFx, fx.status]);

  const refetchFx = useCallback(() => {
    loadFx();
  }, [loadFx]);

  const spotFootnote = useMemo(() => {
    if (unit !== "USD" && unit !== "EUR") return null;
    if (fx.status === "loading" || fx.status === "idle") return null;
    if (fx.status === "error") {
      return "Fiat spot unavailable  -  showing sats.";
    }
    const srcLabel =
      fx.rates.source === "kraken"
        ? "Kraken last trade (XBTUSDC, XBTEUR)"
        : "CoinGecko spot (fallback)";
    return `Fiat from ${srcLabel}, ${fx.rates.fetchedAt}. Display only.`;
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

export function useAdminCurrencyOptional(): AdminCurrencyContextValue | null {
  return useContext(AdminCurrencyContext);
}
