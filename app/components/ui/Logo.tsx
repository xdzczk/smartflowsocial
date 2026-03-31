import { useEffect, useState } from "react";

import { subscribeToDocumentThemeChanges } from "~/lib/theme.client";

interface LogoProps {
  className?: string;
  lightSrc: string;
  darkSrc: string;
  alt: string;
}

export function Logo({ className, lightSrc, darkSrc, alt }: LogoProps) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Use setTimeout to defer setState, avoiding synchronous setState in effect
    const timeoutId = setTimeout(() => {
      setMounted(true);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    return subscribeToDocumentThemeChanges((effectiveTheme) => {
      setIsDark(effectiveTheme === "dark");
    });
  }, []);

  if (!mounted) {
    // SSR: default to dark mode logo
    return <img src={darkSrc} alt={alt} className={className} />;
  }

  return (
    <img src={isDark ? darkSrc : lightSrc} alt={alt} className={className} />
  );
}
