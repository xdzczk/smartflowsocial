import { useEffect, useState } from "react";

function readLocalStorageValue<T>(key: string, initialValue: T): T {
  if (typeof window === "undefined") return initialValue;
  const raw = localStorage.getItem(key);
  if (raw == null) return initialValue;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Legacy: appearance settings wrote raw "dark"|"light"|"system" without JSON.stringify.
    if (
      key === "theme" &&
      (raw === "system" || raw === "light" || raw === "dark")
    ) {
      return raw as T;
    }
    return initialValue;
  }
}

export default function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() =>
    readLocalStorageValue(key, initialValue)
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }, [key, value]);

  return [value, setValue];
}
