import { useEffect, useState } from "react";

/** `true` when viewport is `lg` or wider (matches Tailwind). */
export function useLookupSheetWide(): boolean {
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return wide;
}
