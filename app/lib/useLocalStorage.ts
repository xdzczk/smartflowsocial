import { useEffect, useState } from "react";
export default function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState(() => {
    if (typeof window !== "undefined") {
      const jsonValue = localStorage.getItem(key);
      if (jsonValue != null) return JSON.parse(jsonValue) as T;
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }, [key, value]);

  return [value, setValue];
}
