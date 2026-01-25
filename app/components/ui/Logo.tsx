import { useEffect, useState } from "react";

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
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };

    // Check initial theme
    checkTheme();

    // Watch for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Use setTimeout to defer setState, avoiding synchronous setState in effect
    const timeoutId = setTimeout(() => {
      setMounted(true);
    }, 0);

    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
    };
  }, []);

  if (!mounted) {
    // SSR: default to dark mode logo
    return <img src={darkSrc} alt={alt} className={className} />;
  }

  return (
    <img src={isDark ? darkSrc : lightSrc} alt={alt} className={className} />
  );
}
